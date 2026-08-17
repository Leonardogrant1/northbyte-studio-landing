import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pino from 'pino';
import axios from 'axios';
import {
    getById,
    getLastScheduledPosts,
    createPostFromService,
    SocialAccount,
    AiAvatar,
} from '../lib/convex';
import { getNextScheduleTime } from '../helpers/schedule';
import { planSlides, generateSlideImages, getOpenAIClient } from '../helpers/slides';
import { uploadBufferToR2 } from '../helpers/upload';
import { uploadFromUrl, createPost, PostizMedia } from '../lib/postiz';
import { createJob, readJob, updateJob, SlidePostJob } from '../helpers/jobs';

const logger = pino();

/**
 * Best-effort status update: a failed intermediate write must not abort an
 * already-running (expensive) pipeline. Returns a locally-merged copy of the
 * job so callers can keep using the returned value exactly as before.
 */
async function tryUpdateJob(job: SlidePostJob, patch: Partial<SlidePostJob>): Promise<SlidePostJob> {
    try {
        return await updateJob(job, patch);
    } catch (error: any) {
        logger.warn({ jobId: job.jobId, err: error.message }, 'Job status update failed');
        return { ...job, ...patch };
    }
}
console.log("PEEp")

/** Wartezeit, damit der Dispatch-Request die Instanz sicher verlässt, bevor
 *  die Response gesendet wird und Cloud Run die CPU drosselt. */
const DISPATCH_GRACE_MS = 500;

function getSelfBaseUrl(req: Request): string {
    const host = req.get('host') ?? `localhost:${process.env.PORT || 8080}`;
    return `${req.protocol}://${host}`;
}

/**
 * Nimmt einen Slide-Post-Auftrag an: validiert, legt einen Job in R2 an,
 * stößt den Worker per Self-Request an und antwortet sofort mit 202 + jobId.
 * Fortschritt: GET /slide-posts/jobs/:jobId
 *
 * Body: { accountId: string, topic: string, dryRun?: boolean }
 */
export async function createSlidePostHandler(req: Request, res: Response) {
    const { accountId, topic, dryRun } = (req.body ?? {}) as {
        accountId?: string;
        topic?: string;
        dryRun?: boolean;
    };

    if (!accountId || typeof accountId !== 'string') {
        return res.status(400).json({ error: 'accountId is required' });
    }
    if (!topic || typeof topic !== 'string') {
        return res.status(400).json({ error: 'topic is required' });
    }

    // Validierung bleibt synchron, damit n8n Fehler sofort sieht
    let account: SocialAccount | null;
    try {
        account = await getById<SocialAccount>(accountId);
    } catch (error: any) {
        logger.warn({ accountId, err: error.message }, 'Invalid accountId');
        return res.status(400).json({ error: `Invalid accountId: ${error.message}` });
    }
    if (!account) {
        return res.status(404).json({ error: `Account ${accountId} not found` });
    }
    if (!account.postizId) {
        return res.status(400).json({ error: 'Account has no postizId configured' });
    }
    if (!account.avatarId) {
        return res.status(400).json({ error: 'Account has no avatarId configured' });
    }

    const avatar = await getById<AiAvatar>(account.avatarId);
    if (!avatar) {
        return res.status(400).json({ error: `Avatar ${account.avatarId} not found` });
    }

    const jobId = randomUUID();
    await createJob(jobId);

    const workerUrl = `${getSelfBaseUrl(req)}/slide-posts/jobs/${jobId}/run`;
    const authorization = req.get('authorization');
    const dispatch = axios
        .post(
            workerUrl,
            { accountId, topic, dryRun, account, avatar },
            { headers: authorization ? { authorization } : {}, timeout: 0 }
        )
        .then(() => undefined)
        .catch(async (error: any) => {
            // Worker antwortet immer 200 — ein axios-Fehler ist also ein Transportproblem.
            logger.error({ jobId, err: error.message }, 'Worker dispatch failed');
            try {
                const current = await readJob(jobId);
                if (current && current.status === 'queued') {
                    await updateJob(current, {
                        status: 'failed',
                        error: `Worker dispatch failed: ${error.message}`,
                    });
                }
            } catch (updateError: any) {
                logger.error({ jobId, err: updateError.message }, 'Failed to mark job as failed');
            }
        });

    // Kurze Grace-Period, damit der Request rausgeht, bevor die CPU gedrosselt wird
    await Promise.race([dispatch, new Promise((resolve) => setTimeout(resolve, DISPATCH_GRACE_MS))]);

    return res.status(202).json({ jobId });
}

/** Liefert den Status eines Slide-Post-Jobs aus R2. */
export async function getSlidePostJobHandler(req: Request, res: Response) {
    const { jobId } = req.params as { jobId: string };
    const job = await readJob(jobId);
    if (!job) {
        return res.status(404).json({ error: `Job ${jobId} not found` });
    }
    return res.status(200).json(job);
}

interface RunJobBody {
    accountId: string;
    topic: string;
    dryRun?: boolean;
    account: SocialAccount;
    avatar: AiAvatar;
}

/**
 * Interner Worker: führt die Slide-Post-Pipeline für einen queued Job aus.
 * Wird per Self-Request vom Create-Handler aufgerufen; die Response konsumiert
 * niemand — der offene Request hält nur die CPU der Instanz aktiv.
 * Antwortet deshalb auch bei Pipeline-Fehlern 200 (Status steht in der Job-JSON).
 */
export async function runSlidePostJobHandler(req: Request, res: Response) {
    const { jobId } = req.params as { jobId: string };
    const { accountId, topic, dryRun, account, avatar } = (req.body ?? {}) as RunJobBody;

    if (!accountId || !topic || !account || !avatar) {
        return res.status(400).json({ error: 'accountId, topic, account and avatar are required' });
    }

    let job = await readJob(jobId);
    if (!job) {
        return res.status(404).json({ error: `Job ${jobId} not found` });
    }
    if (job.status !== 'queued') {
        return res.status(409).json({ error: `Job ${jobId} is already ${job.status}` });
    }

    job = await updateJob(job, { status: 'running', step: 'planning' });

    try {
        // 1. Slides planen + Bilder generieren
        logger.info({ jobId, accountId, topic, username: account.username }, 'Planning slides');
        const openai = getOpenAIClient();
        const plan = await planSlides(openai, topic, avatar);
        const images = await generateSlideImages(openai, plan, avatar.imageUrl, async (slideNumber) => {
            job = await tryUpdateJob(job!, { step: `slide-${slideNumber}` });
        });

        // 2. R2-Upload
        job = await tryUpdateJob(job, { step: 'uploading' });
        const mediaUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
            const url = await uploadBufferToR2(
                images[i],
                `slide-posts/${jobId}/slide-${i + 1}.png`,
                'image/png'
            );
            mediaUrls.push(url);
        }
        logger.info({ jobId, mediaUrls }, 'Slides uploaded to R2');

        if (dryRun) {
            await updateJob(job, {
                status: 'done',
                result: { dryRun: true, caption: plan.caption, slides: plan.slides, mediaUrls },
            });
            return res.status(200).json({ jobId, status: 'done' });
        }

        // 3. Postiz-Upload
        job = await tryUpdateJob(job, { step: 'postiz' });
        const postizMedia: PostizMedia[] = [];
        for (const url of mediaUrls) {
            postizMedia.push(await uploadFromUrl(url));
        }

        // 4. Nächster freier Slot (gegen die zuletzt geplanten Posts gerechnet)
        job = await tryUpdateJob(job, { step: 'scheduling' });
        const lastPosts = await getLastScheduledPosts(accountId, 10);
        const scheduledAt = getNextScheduleTime(account, lastPosts) ?? undefined;
        if (!scheduledAt) {
            logger.warn({ jobId, accountId }, 'No postingTimes configured - posting immediately');
        }

        // 5. Postiz-Post anlegen
        const postizPostId = await createPost({
            integrationId: account.postizId!,
            platform: account.platform,
            content: plan.caption,
            media: postizMedia,
            scheduledAt,
        });
        logger.info({ jobId, postizPostId, scheduledAt }, 'Postiz post created');

        // 6. Post in Convex eintragen (macht den Slot für Folge-Aufrufe sichtbar)
        job = await tryUpdateJob(job, { step: 'convex' });
        const convexPostId = await createPostFromService({
            title: topic,
            description: plan.caption,
            mediaUrls,
            accountId,
            scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
            postizPostId,
        });

        await updateJob(job, {
            status: 'done',
            result: {
                postizPostId,
                convexPostId,
                scheduledAt: scheduledAt ?? 'now',
                caption: plan.caption,
                slides: plan.slides,
                mediaUrls,
            },
        });
        return res.status(200).json({ jobId, status: 'done' });
    } catch (error: any) {
        logger.error({ jobId, err: error.message, stack: error.stack }, 'Slide post job failed');
        try {
            await updateJob(job, { status: 'failed', error: error.message });
        } catch (updateError: any) {
            logger.error({ jobId, err: updateError.message }, 'Failed to mark job as failed');
        }
        return res.status(200).json({ jobId, status: 'failed' });
    }
}
