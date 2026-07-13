# Async Slide-Post-Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /slide-posts/create` antwortet sofort mit einer Job-ID; die ~9-minütige Pipeline läuft als interner Worker-Request weiter, Status ist über einen Poll-Endpoint abrufbar (Job-JSON im R2-Bucket `n8n-media`).

**Architecture:** Self-Request-Pattern für Cloud Run (CPU-Throttling nach Response, `containerConcurrency: 1`): Create-Handler validiert, legt `slide-posts/jobs/<jobId>.json` in R2 an, feuert einen fire-and-forget-Request an den eigenen Service (`/slide-posts/jobs/:jobId/run`) und antwortet `202 { jobId }`. Der Worker führt die bestehende Pipeline aus und schreibt Statusupdates in die Job-JSON. `GET /slide-posts/jobs/:jobId` liest die JSON — instanzunabhängig, keine Datenbank.

**Tech Stack:** Express 5, TypeScript (ESM), `@aws-sdk/client-s3` (R2), axios, Vitest (neu, devDependency).

**Spec:** `docs/superpowers/specs/2026-07-09-slide-post-async-jobs-design.md`

## Global Constraints

- Arbeitsverzeichnis: `cloud-run/n8n-helpers` (alle Pfade unten relativ dazu, alle Befehle dort ausführen).
- **Keine Git-Commits** — der User übernimmt alle Git-Operationen selbst. Die Commit-Schritte des üblichen TDD-Zyklus entfallen ersatzlos.
- Bestehende Pipeline-Logik (`planSlides`, `generateSlideImages`, R2/Postiz/Convex-Aufrufe) unverändert lassen, nur umziehen; einzige Ausnahme: optionaler `onSlide`-Callback in `generateSlideImages`.
- Job-Key-Schema exakt: `slide-posts/jobs/<jobId>.json`, Bucket = `R2_BUCKET_NAME` (deployed: `n8n-media`).
- Statuswerte exakt: `queued | running | done | failed`; Steps: `planning`, `slide-1`…`slide-4`, `uploading`, `postiz`, `scheduling`, `convex`.
- Abweichung zur Spec (dort „Antwortet 200/500“): Der Worker antwortet auch bei Pipeline-Fehlern **200** (Fehler steht in der Job-JSON). So kann der Create-Handler jeden axios-Fehler des Dispatch eindeutig als Transportproblem werten. Die Antwort konsumiert ohnehin niemand.

---

### Task 1: Vitest-Setup + Job-Store (`src/helpers/jobs.ts`)

**Files:**
- Modify: `package.json` (devDependency `vitest`, Script `test`)
- Create: `src/helpers/jobs.ts`
- Test: `src/helpers/jobs.test.ts`

**Interfaces:**
- Consumes: `r2Client`, `R2_BUCKET_NAME` aus `src/lib/r2.ts` (bestehend)
- Produces (von Task 2–4 benutzt):
  - `type JobStatus = 'queued' | 'running' | 'done' | 'failed'`
  - `interface SlidePostJob { jobId: string; status: JobStatus; step?: string; createdAt: number; updatedAt: number; result?: Record<string, unknown>; error?: string }`
  - `createJob(jobId: string): Promise<SlidePostJob>` — schreibt `queued`-Job
  - `updateJob(job: SlidePostJob, patch: Partial<SlidePostJob>): Promise<SlidePostJob>` — merged Patch, setzt `updatedAt`, schreibt
  - `readJob(jobId: string): Promise<SlidePostJob | null>` — `null` wenn Key fehlt

- [ ] **Step 1: Vitest installieren und Test-Script anlegen**

```bash
cd cloud-run/n8n-helpers && pnpm add -D vitest
```

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "vitest run"
```

- [ ] **Step 2: Failing Test schreiben** — `src/helpers/jobs.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/r2', () => ({
    r2Client: { send: vi.fn() },
    R2_BUCKET_NAME: 'test-bucket',
}));

import { r2Client } from '../lib/r2';
import { createJob, updateJob, readJob, SlidePostJob } from './jobs';

const sendMock = r2Client.send as ReturnType<typeof vi.fn>;

beforeEach(() => {
    sendMock.mockReset();
});

describe('createJob', () => {
    it('writes a queued job JSON to the correct key', async () => {
        sendMock.mockResolvedValue({});

        const job = await createJob('abc-123');

        expect(job.status).toBe('queued');
        expect(job.jobId).toBe('abc-123');
        expect(job.createdAt).toBeGreaterThan(0);
        expect(job.updatedAt).toBe(job.createdAt);

        expect(sendMock).toHaveBeenCalledTimes(1);
        const command = sendMock.mock.calls[0][0];
        expect(command.input.Bucket).toBe('test-bucket');
        expect(command.input.Key).toBe('slide-posts/jobs/abc-123.json');
        expect(command.input.ContentType).toBe('application/json');
        expect(JSON.parse(command.input.Body).status).toBe('queued');
    });
});

describe('updateJob', () => {
    it('merges the patch and bumps updatedAt', async () => {
        sendMock.mockResolvedValue({});
        const job: SlidePostJob = {
            jobId: 'abc-123',
            status: 'queued',
            createdAt: 1000,
            updatedAt: 1000,
        };

        const updated = await updateJob(job, { status: 'running', step: 'planning' });

        expect(updated.status).toBe('running');
        expect(updated.step).toBe('planning');
        expect(updated.createdAt).toBe(1000);
        expect(updated.updatedAt).toBeGreaterThan(1000);
        expect(JSON.parse(sendMock.mock.calls[0][0].input.Body).step).toBe('planning');
    });
});

describe('readJob', () => {
    it('parses the job JSON from the bucket', async () => {
        const stored: SlidePostJob = {
            jobId: 'abc-123',
            status: 'done',
            createdAt: 1,
            updatedAt: 2,
            result: { caption: 'hi' },
        };
        sendMock.mockResolvedValue({
            Body: { transformToString: async () => JSON.stringify(stored) },
        });

        const job = await readJob('abc-123');

        expect(job).toEqual(stored);
        expect(sendMock.mock.calls[0][0].input.Key).toBe('slide-posts/jobs/abc-123.json');
    });

    it('returns null when the key does not exist', async () => {
        sendMock.mockRejectedValue(Object.assign(new Error('no key'), { name: 'NoSuchKey' }));
        expect(await readJob('missing')).toBeNull();
    });

    it('rethrows other errors', async () => {
        sendMock.mockRejectedValue(Object.assign(new Error('boom'), { name: 'InternalError' }));
        await expect(readJob('abc-123')).rejects.toThrow('boom');
    });
});
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `pnpm test`
Expected: FAIL — `Cannot find module './jobs'` (bzw. „Failed to load …/jobs“)

- [ ] **Step 4: Implementierung** — `src/helpers/jobs.ts`:

```typescript
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '../lib/r2';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface SlidePostJob {
    jobId: string;
    status: JobStatus;
    step?: string;
    createdAt: number;
    updatedAt: number;
    result?: Record<string, unknown>;
    error?: string;
}

function jobKey(jobId: string): string {
    return `slide-posts/jobs/${jobId}.json`;
}

async function writeJob(job: SlidePostJob): Promise<void> {
    await r2Client.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: jobKey(job.jobId),
            Body: JSON.stringify(job),
            ContentType: 'application/json',
        })
    );
}

export async function createJob(jobId: string): Promise<SlidePostJob> {
    const now = Date.now();
    const job: SlidePostJob = { jobId, status: 'queued', createdAt: now, updatedAt: now };
    await writeJob(job);
    return job;
}

export async function updateJob(
    job: SlidePostJob,
    patch: Partial<SlidePostJob>
): Promise<SlidePostJob> {
    const updated: SlidePostJob = { ...job, ...patch, updatedAt: Date.now() };
    await writeJob(updated);
    return updated;
}

export async function readJob(jobId: string): Promise<SlidePostJob | null> {
    try {
        const response = await r2Client.send(
            new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: jobKey(jobId) })
        );
        const body = await response.Body?.transformToString();
        if (!body) {
            return null;
        }
        return JSON.parse(body) as SlidePostJob;
    } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
            return null;
        }
        throw error;
    }
}
```

Hinweis zu `updateJob`: `updatedAt: Date.now()` steht nach dem Spread, überschreibt also auch einen `updatedAt` aus `patch` — gewollt.

- [ ] **Step 5: Tests laufen lassen — müssen grün sein**

Run: `pnpm test`
Expected: PASS (5 Tests)

---

### Task 2: Status-Endpoint (`GET /slide-posts/jobs/:jobId`)

**Files:**
- Modify: `src/routes/slidePost.ts` (Handler ergänzen)
- Modify: `src/index.ts` (Route registrieren)
- Test: `src/routes/slidePost.test.ts` (neu)

**Interfaces:**
- Consumes: `readJob` aus Task 1
- Produces: `getSlidePostJobHandler(req, res)` — `200` + Job-JSON oder `404 { error }`; Route `GET /slide-posts/jobs/:jobId`

- [ ] **Step 1: Failing Test schreiben** — `src/routes/slidePost.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../helpers/jobs', () => ({
    createJob: vi.fn(),
    updateJob: vi.fn(),
    readJob: vi.fn(),
}));

import { readJob } from '../helpers/jobs';
import { getSlidePostJobHandler } from './slidePost';

const readJobMock = readJob as ReturnType<typeof vi.fn>;

function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getSlidePostJobHandler', () => {
    it('returns the job JSON', async () => {
        const job = { jobId: 'abc', status: 'running', step: 'slide-2', createdAt: 1, updatedAt: 2 };
        readJobMock.mockResolvedValue(job);
        const res = mockRes();

        await getSlidePostJobHandler({ params: { jobId: 'abc' } } as any, res);

        expect(readJobMock).toHaveBeenCalledWith('abc');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(job);
    });

    it('returns 404 for unknown jobs', async () => {
        readJobMock.mockResolvedValue(null);
        const res = mockRes();

        await getSlidePostJobHandler({ params: { jobId: 'nope' } } as any, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Job nope not found' });
    });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm test`
Expected: FAIL — `getSlidePostJobHandler` wird nicht exportiert

- [ ] **Step 3: Handler implementieren** — in `src/routes/slidePost.ts` ergänzen (Imports oben erweitern):

```typescript
import { readJob } from '../helpers/jobs';

/** Liefert den Status eines Slide-Post-Jobs aus R2. */
export async function getSlidePostJobHandler(req: Request, res: Response) {
    const { jobId } = req.params as { jobId: string };
    const job = await readJob(jobId);
    if (!job) {
        return res.status(404).json({ error: `Job ${jobId} not found` });
    }
    return res.status(200).json(job);
}
```

- [ ] **Step 4: Route registrieren** — in `src/index.ts`:

Import erweitern:

```typescript
import { createSlidePostHandler, getSlidePostJobHandler } from './routes/slidePost';
```

Nach der bestehenden `/slide-posts/create`-Route:

```typescript
// Poll the status of a slide post job
app.get('/slide-posts/jobs/:jobId', getSlidePostJobHandler);
```

- [ ] **Step 5: Tests + Type-Check laufen lassen**

Run: `pnpm test && pnpm type-check`
Expected: PASS (7 Tests), keine TS-Fehler

---

### Task 3: Worker-Endpoint (`POST /slide-posts/jobs/:jobId/run`)

**Files:**
- Modify: `src/helpers/slides.ts` (optionaler `onSlide`-Callback)
- Modify: `src/routes/slidePost.ts` (Pipeline in Worker-Handler umziehen)
- Modify: `src/index.ts` (Route registrieren)
- Test: `src/routes/slidePost.test.ts` (erweitern)

**Interfaces:**
- Consumes: `readJob`, `updateJob` (Task 1); bestehende Helpers `planSlides`, `generateSlideImages`, `getOpenAIClient`, `uploadBufferToR2`, `uploadFromUrl`, `createPost`, `getLastScheduledPosts`, `createPostFromService`, `getNextScheduleTime`; Typen `SocialAccount`, `AiAvatar` aus `src/lib/convex.ts`
- Produces:
  - `runSlidePostJobHandler(req, res)` — Body `{ accountId: string; topic: string; dryRun?: boolean; account: SocialAccount; avatar: AiAvatar }`; Route `POST /slide-posts/jobs/:jobId/run`. Antwortet 200 (auch bei Pipeline-Fehler — Status steht im Job), 400 bei fehlendem Body, 404 bei unbekanntem Job, 409 wenn Job nicht mehr `queued`.
  - `generateSlideImages(openai, plan, avatarImageUrl, onSlide?)` — neuer optionaler Parameter `onSlide?: (slideNumber: number) => Promise<void>`, wird vor jeder Slide mit `1..4` aufgerufen.

- [ ] **Step 1: Failing Tests schreiben** — in `src/routes/slidePost.test.ts` ergänzen. Die Mocks oben in der Datei erweitern (alle `vi.mock`-Aufrufe müssen VOR den Imports der gemockten Module stehen — bestehenden `vi.mock('../helpers/jobs', …)`-Block stehen lassen):

```typescript
vi.mock('../helpers/slides', () => ({
    getOpenAIClient: vi.fn().mockReturnValue({}),
    planSlides: vi.fn(),
    generateSlideImages: vi.fn(),
}));
vi.mock('../helpers/upload', () => ({ uploadBufferToR2: vi.fn() }));
vi.mock('../lib/postiz', () => ({ uploadFromUrl: vi.fn(), createPost: vi.fn() }));
vi.mock('../lib/convex', () => ({
    getById: vi.fn(),
    getLastScheduledPosts: vi.fn(),
    createPostFromService: vi.fn(),
}));
vi.mock('../helpers/schedule', () => ({ getNextScheduleTime: vi.fn() }));

import { createJob, updateJob } from '../helpers/jobs';
import { planSlides, generateSlideImages } from '../helpers/slides';
import { uploadBufferToR2 } from '../helpers/upload';
import { uploadFromUrl, createPost } from '../lib/postiz';
import { getLastScheduledPosts, createPostFromService } from '../lib/convex';
import { getNextScheduleTime } from '../helpers/schedule';
import { runSlidePostJobHandler } from './slidePost';
```

Tests anhängen:

```typescript
describe('runSlidePostJobHandler', () => {
    const account = { postizId: 'pz-1', avatarId: 'av-1', platform: 'tiktok', username: 'u' };
    const avatar = { name: 'Avatar', description: 'desc', imageUrl: 'https://img' };
    const body = { accountId: 'acc-1', topic: 'Sprungkraft', account, avatar };
    const plan = {
        caption: 'caption #tag',
        slides: [{ text: 't', sceneDescription: 's' }],
    };

    function queuedJob() {
        return { jobId: 'job-1', status: 'queued', createdAt: 1, updatedAt: 1 };
    }

    it('runs the pipeline and marks the job done', async () => {
        readJobMock.mockResolvedValue(queuedJob());
        (updateJob as any).mockImplementation(async (job: any, patch: any) => ({ ...job, ...patch }));
        (planSlides as any).mockResolvedValue(plan);
        (generateSlideImages as any).mockResolvedValue([Buffer.from('img')]);
        (uploadBufferToR2 as any).mockResolvedValue('https://r2/slide-1.png');
        (uploadFromUrl as any).mockResolvedValue({ id: 'media-1', path: 'p' });
        (getLastScheduledPosts as any).mockResolvedValue([]);
        (getNextScheduleTime as any).mockReturnValue('2026-07-10T10:00:00Z');
        (createPost as any).mockResolvedValue('postiz-1');
        (createPostFromService as any).mockResolvedValue('convex-1');
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const patches = (updateJob as any).mock.calls.map((c: any) => c[1]);
        expect(patches[0]).toMatchObject({ status: 'running', step: 'planning' });
        expect(patches[patches.length - 1]).toMatchObject({
            status: 'done',
            result: expect.objectContaining({ postizPostId: 'postiz-1', convexPostId: 'convex-1' }),
        });
    });

    it('marks the job done after upload when dryRun is set', async () => {
        readJobMock.mockResolvedValue(queuedJob());
        (updateJob as any).mockImplementation(async (job: any, patch: any) => ({ ...job, ...patch }));
        (planSlides as any).mockResolvedValue(plan);
        (generateSlideImages as any).mockResolvedValue([Buffer.from('img')]);
        (uploadBufferToR2 as any).mockResolvedValue('https://r2/slide-1.png');
        const res = mockRes();

        await runSlidePostJobHandler(
            { params: { jobId: 'job-1' }, body: { ...body, dryRun: true } } as any,
            res
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(uploadFromUrl).not.toHaveBeenCalled();
        const lastPatch = (updateJob as any).mock.calls.at(-1)[1];
        expect(lastPatch).toMatchObject({
            status: 'done',
            result: expect.objectContaining({ dryRun: true }),
        });
    });

    it('marks the job failed when the pipeline throws', async () => {
        readJobMock.mockResolvedValue(queuedJob());
        (updateJob as any).mockImplementation(async (job: any, patch: any) => ({ ...job, ...patch }));
        (planSlides as any).mockRejectedValue(new Error('openai down'));
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const lastPatch = (updateJob as any).mock.calls.at(-1)[1];
        expect(lastPatch).toMatchObject({ status: 'failed', error: expect.stringContaining('openai down') });
    });

    it('returns 409 when the job is not queued anymore', async () => {
        readJobMock.mockResolvedValue({ ...queuedJob(), status: 'running' });
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(planSlides).not.toHaveBeenCalled();
    });

    it('returns 404 when the job does not exist', async () => {
        readJobMock.mockResolvedValue(null);
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm test`
Expected: FAIL — `runSlidePostJobHandler` wird nicht exportiert

- [ ] **Step 3: `onSlide`-Callback in `generateSlideImages`** — `src/helpers/slides.ts`, Signatur erweitern:

```typescript
export async function generateSlideImages(
    openai: OpenAI,
    plan: SlidePlan,
    avatarImageUrl: string,
    onSlide?: (slideNumber: number) => Promise<void>
): Promise<Buffer[]> {
```

Und in der Schleife direkt nach `logger.info(...)`:

```typescript
        await onSlide?.(index + 1);
```

- [ ] **Step 4: Worker-Handler implementieren** — in `src/routes/slidePost.ts`. Die Pipeline-Schritte 2–7 aus dem bestehenden `createSlidePostHandler` ziehen hierher um (Task 4 baut den Create-Handler danach um):

```typescript
import { readJob, updateJob } from '../helpers/jobs';

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
            job = await updateJob(job!, { step: `slide-${slideNumber}` });
        });

        // 2. R2-Upload
        job = await updateJob(job, { step: 'uploading' });
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
        job = await updateJob(job, { step: 'postiz' });
        const postizMedia: PostizMedia[] = [];
        for (const url of mediaUrls) {
            postizMedia.push(await uploadFromUrl(url));
        }

        // 4. Nächster freier Slot (gegen die zuletzt geplanten Posts gerechnet)
        job = await updateJob(job, { step: 'scheduling' });
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
        job = await updateJob(job, { step: 'convex' });
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
        await updateJob(job, { status: 'failed', error: error.message });
        return res.status(200).json({ jobId, status: 'failed' });
    }
}
```

Hinweise:
- `randomUUID` aus dem R2-Pfad ersetzt durch `jobId` — pro Job eindeutig, gleiche Funktion wie der bisherige `runId`.
- `account.postizId!` ist sicher: Der Create-Handler (Task 4) validiert `postizId` bevor er den Job anlegt.
- Der Import von `randomUUID` bleibt in der Datei (der Create-Handler in Task 4 braucht ihn weiter).

- [ ] **Step 5: Route registrieren** — in `src/index.ts`:

```typescript
import { createSlidePostHandler, getSlidePostJobHandler, runSlidePostJobHandler } from './routes/slidePost';
```

```typescript
// Internal worker: executes a queued slide post job (called via self-request)
app.post('/slide-posts/jobs/:jobId/run', runSlidePostJobHandler);
```

- [ ] **Step 6: Tests + Type-Check laufen lassen**

Run: `pnpm test && pnpm type-check`
Expected: PASS (12 Tests), keine TS-Fehler

---

### Task 4: Create-Handler umbauen (`POST /slide-posts/create` → 202 + Dispatch)

**Files:**
- Modify: `src/routes/slidePost.ts` (`createSlidePostHandler` ersetzen)
- Test: `src/routes/slidePost.test.ts` (erweitern)

**Interfaces:**
- Consumes: `createJob`, `readJob`, `updateJob` (Task 1); Worker-Route aus Task 3; `getById` aus `src/lib/convex.ts`; `axios` (bestehende Dependency)
- Produces: `createSlidePostHandler(req, res)` — Body unverändert `{ accountId, topic, dryRun? }`; antwortet `202 { jobId }` nach erfolgreicher Validierung + Job-Anlage + Dispatch; 400/404 wie bisher bei Validierungsfehlern.

- [ ] **Step 1: Failing Tests schreiben** — in `src/routes/slidePost.test.ts` ergänzen:

```typescript
vi.mock('axios', () => ({ default: { post: vi.fn() } }));

import axios from 'axios';
import { getById } from '../lib/convex';
import { createSlidePostHandler } from './slidePost';

describe('createSlidePostHandler', () => {
    const account = { postizId: 'pz-1', avatarId: 'av-1', platform: 'tiktok', username: 'u' };
    const avatar = { name: 'Avatar', description: 'desc', imageUrl: 'https://img' };

    function mockReq(body: any) {
        return {
            body,
            protocol: 'https',
            get: vi.fn((header: string) => {
                if (header === 'host') return 'n8n-helpers.example.com';
                if (header === 'authorization') return 'Bearer token-1';
                return undefined;
            }),
        } as any;
    }

    it('validates, creates a queued job, dispatches the worker and returns 202', async () => {
        (getById as any).mockResolvedValueOnce(account).mockResolvedValueOnce(avatar);
        (createJob as any).mockResolvedValue({ jobId: 'x', status: 'queued', createdAt: 1, updatedAt: 1 });
        (axios.post as any).mockReturnValue(new Promise(() => {})); // Worker antwortet nie während des Tests
        const res = mockRes();

        await createSlidePostHandler(mockReq({ accountId: 'acc-1', topic: 'Sprungkraft' }), res);

        expect(createJob).toHaveBeenCalledTimes(1);
        const jobId = (createJob as any).mock.calls[0][0];

        expect(axios.post).toHaveBeenCalledWith(
            `https://n8n-helpers.example.com/slide-posts/jobs/${jobId}/run`,
            { accountId: 'acc-1', topic: 'Sprungkraft', dryRun: undefined, account, avatar },
            { headers: { authorization: 'Bearer token-1' }, timeout: 0 }
        );
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json).toHaveBeenCalledWith({ jobId });
    });

    it('returns 400 without accountId and creates no job', async () => {
        const res = mockRes();
        await createSlidePostHandler(mockReq({ topic: 'x' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(createJob).not.toHaveBeenCalled();
    });

    it('returns 404 when the account does not exist', async () => {
        (getById as any).mockResolvedValue(null);
        const res = mockRes();
        await createSlidePostHandler(mockReq({ accountId: 'acc-1', topic: 'x' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(createJob).not.toHaveBeenCalled();
    });

    it('marks the job failed when the dispatch fails while still queued', async () => {
        (getById as any).mockResolvedValueOnce(account).mockResolvedValueOnce(avatar);
        const job = { jobId: 'x', status: 'queued', createdAt: 1, updatedAt: 1 };
        (createJob as any).mockResolvedValue(job);
        readJobMock.mockResolvedValue(job);
        (axios.post as any).mockRejectedValue(new Error('ECONNREFUSED'));
        const res = mockRes();

        await createSlidePostHandler(mockReq({ accountId: 'acc-1', topic: 'x' }), res);
        await new Promise((r) => setTimeout(r, 0)); // catch-Handler des Dispatch abwarten

        expect(res.status).toHaveBeenCalledWith(202);
        expect(updateJob).toHaveBeenCalledWith(
            job,
            expect.objectContaining({ status: 'failed', error: expect.stringContaining('ECONNREFUSED') })
        );
    });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm test`
Expected: FAIL — der bestehende `createSlidePostHandler` antwortet nicht mit 202 / ruft `createJob` nicht auf

- [ ] **Step 3: Create-Handler ersetzen** — in `src/routes/slidePost.ts`. Import ergänzen (`axios` oben in der Datei, `createJob` zum bestehenden jobs-Import):

```typescript
import axios from 'axios';
import { createJob, readJob, updateJob } from '../helpers/jobs';
```

Den kompletten bisherigen `createSlidePostHandler` ersetzen durch:

```typescript
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
```

Achtung Test-Detail: Im 202-Happy-Path-Test hängt `axios.post` für immer (`new Promise(() => {})`) — der Handler kehrt dank `Promise.race` nach 500ms zurück; der Test dauert also ~0,5s, das ist ok.

- [ ] **Step 4: Tests + Type-Check laufen lassen**

Run: `pnpm test && pnpm type-check`
Expected: PASS (16 Tests), keine TS-Fehler

- [ ] **Step 5: Aufräum-Check**

Sicherstellen, dass in `src/routes/slidePost.ts` keine toten Reste bleiben: Die Imports `planSlides`, `generateSlideImages`, `getOpenAIClient`, `uploadBufferToR2`, `uploadFromUrl`, `createPost`, `PostizMedia`, `getLastScheduledPosts`, `createPostFromService`, `getNextScheduleTime` werden jetzt vom Worker-Handler benutzt; `getById`, `randomUUID`, `axios`, jobs-Helpers vom Create-Handler. `pnpm type-check` meldet ungenutzte Imports nicht — kurz per Auge prüfen.

---

### Task 5: Build, Versions-Bump und lokaler Smoke-Test

**Files:**
- Modify: `package.json` (Version `1.0.7` → `1.1.0`)

**Interfaces:**
- Consumes: alles aus Task 1–4
- Produces: deploybarer Stand (Deploy + n8n-Workflow-Umbau macht der User)

- [ ] **Step 1: Version bumpen**

In `package.json`: `"version": "1.1.0"`

- [ ] **Step 2: Voller Check**

Run: `pnpm test && pnpm type-check && pnpm build`
Expected: Tests PASS, keine TS-Fehler, Build schreibt `dist/index.js`

- [ ] **Step 3: Lokaler Smoke-Test (manuell, braucht `.env` mit R2- und Convex-Credentials)**

```bash
pnpm dev
# zweites Terminal:
curl -s -X POST localhost:8080/slide-posts/create \
  -H 'Content-Type: application/json' \
  -d '{"accountId":"<echte-account-id>","topic":"Test","dryRun":true}'
# → sofort: {"jobId":"…"}
curl -s localhost:8080/slide-posts/jobs/<jobId>
# → status wandert queued → running (step: planning, slide-1…) → done mit result
```

Expected: Create antwortet in <2s mit `202 { jobId }`; der Status-Endpoint zeigt den Fortschritt; bei `dryRun` endet der Job mit `done` und `result.dryRun === true`. (Ohne OpenAI-Key endet er mit `failed` + Fehlermeldung — auch das validiert den Mechanismus.)

- [ ] **Step 4: Übergabe an den User**

Kein Commit, kein Deploy durch den Agenten. Dem User melden:
- `pnpm deploy` (nutzt `deploy-cloud-run.sh n8n-helpers`) zum Ausrollen
- n8n-Workflow umbauen: Create-Call (Timeout Default reicht) → Wait 30s → `GET /slide-posts/jobs/{{jobId}}` → If `done` → weiter; `failed` → Error-Pfad; `running`/`queued` → zurück zum Wait; zusätzlich abbrechen, wenn `updatedAt` älter als 15 Min ist
