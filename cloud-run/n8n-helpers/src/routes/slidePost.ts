import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import pino from 'pino';
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

const logger = pino();

/**
 * Erstellt einen kompletten TikTok-Slide-Post für einen Account:
 * Slides generieren → R2 → Postiz-Upload → nächster freier Slot → schedulen
 * → Post in Convex eintragen.
 *
 * Body: { accountId: string, topic: string, dryRun?: boolean }
 * dryRun stoppt nach dem R2-Upload (kein Postiz, kein Convex-Post).
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

    // 1. Account + Avatar aus Convex
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

    try {
        // 2. Slides planen + Bilder generieren
        logger.info({ accountId, topic, username: account.username }, 'Planning slides');
        const openai = getOpenAIClient();
        const plan = await planSlides(openai, topic, avatar);
        const images = await generateSlideImages(openai, plan, avatar.imageUrl);

        // 3. R2-Upload
        const runId = randomUUID();
        const mediaUrls: string[] = [];
        for (let i = 0; i < images.length; i++) {
            const url = await uploadBufferToR2(
                images[i],
                `slide-posts/${runId}/slide-${i + 1}.png`,
                'image/png'
            );
            mediaUrls.push(url);
        }
        logger.info({ runId, mediaUrls }, 'Slides uploaded to R2');

        if (dryRun) {
            return res.status(200).json({
                dryRun: true,
                caption: plan.caption,
                slides: plan.slides,
                mediaUrls,
            });
        }

        // 4. Postiz-Upload
        const postizMedia: PostizMedia[] = [];
        for (const url of mediaUrls) {
            postizMedia.push(await uploadFromUrl(url));
        }

        // 5. Nächster freier Slot (gegen die zuletzt geplanten Posts gerechnet)
        const lastPosts = await getLastScheduledPosts(accountId, 10);
        const scheduledAt = getNextScheduleTime(account, lastPosts) ?? undefined;
        if (!scheduledAt) {
            logger.warn({ accountId }, 'No postingTimes configured - posting immediately');
        }

        // 6. Postiz-Post anlegen
        const postizPostId = await createPost({
            integrationId: account.postizId,
            platform: account.platform,
            content: plan.caption,
            media: postizMedia,
            scheduledAt,
        });
        logger.info({ postizPostId, scheduledAt }, 'Postiz post created');

        // 7. Post in Convex eintragen (macht den Slot für Folge-Aufrufe sichtbar)
        const convexPostId = await createPostFromService({
            title: topic,
            description: plan.caption,
            mediaUrls,
            accountId,
            scheduledAt: scheduledAt ? new Date(scheduledAt).getTime() : undefined,
            postizPostId,
        });

        return res.status(200).json({
            postizPostId,
            convexPostId,
            scheduledAt: scheduledAt ?? 'now',
            caption: plan.caption,
            slides: plan.slides,
            mediaUrls,
        });
    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, 'Slide post creation failed');
        return res.status(502).json({ error: `Slide post creation failed: ${error.message}` });
    }
}
