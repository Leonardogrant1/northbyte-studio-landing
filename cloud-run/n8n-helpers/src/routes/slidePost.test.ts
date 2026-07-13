import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

vi.mock('../helpers/jobs', () => ({
    createJob: vi.fn(),
    updateJob: vi.fn(),
    readJob: vi.fn(),
}));

vi.mock('../helpers/slides', () => ({
    getOpenAIClient: vi.fn(),
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

import axios from 'axios';
import { createJob, updateJob, readJob } from '../helpers/jobs';
import { getOpenAIClient, planSlides, generateSlideImages } from '../helpers/slides';
import { uploadBufferToR2 } from '../helpers/upload';
import { uploadFromUrl, createPost } from '../lib/postiz';
import { getById, getLastScheduledPosts, createPostFromService } from '../lib/convex';
import { getNextScheduleTime } from '../helpers/schedule';
import { createSlidePostHandler, getSlidePostJobHandler, runSlidePostJobHandler } from './slidePost';

const readJobMock = readJob as ReturnType<typeof vi.fn>;

function mockRes() {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    // Reset clears both call history AND implementations set between tests,
    // preventing mock-implementation leakage across test boundaries.
    vi.resetAllMocks();
    // Re-establish the getOpenAIClient default that the vi.mock factory
    // previously provided — vi.resetAllMocks() wipes factory-set implementations.
    (getOpenAIClient as ReturnType<typeof vi.fn>).mockReturnValue({});
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
        // Invoke the onSlide callback so the slide-N progress write is exercised.
        (generateSlideImages as any).mockImplementation(
            async (_openai: any, _plan: any, _url: any, onSlide?: (n: number) => Promise<void>) => {
                await onSlide?.(1);
                return [Buffer.from('img')];
            }
        );
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
        // onSlide callback must have written an intermediate slide-1 progress patch
        expect(patches).toContainEqual(expect.objectContaining({ step: 'slide-1' }));
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

    it('still responds 200 when marking the job failed also fails', async () => {
        readJobMock.mockResolvedValue(queuedJob());
        (updateJob as any)
            .mockImplementationOnce(async (job: any, patch: any) => ({ ...job, ...patch }))
            .mockRejectedValue(new Error('r2 down'));
        (planSlides as any).mockRejectedValue(new Error('openai down'));
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ jobId: 'job-1', status: 'failed' });
    });

    it('completes the pipeline even when a progress status-write (uploading) fails', async () => {
        readJobMock.mockResolvedValue(queuedJob());
        // First call is the strict initial write (running/planning) — must succeed.
        // Second call is the first tryUpdateJob call (slide-1) — must succeed.
        // Third call is the tryUpdateJob for uploading — simulate transient R2 failure.
        // All subsequent calls succeed normally.
        (updateJob as any).mockImplementation(async (job: any, patch: any) => {
            if (patch.step === 'uploading') {
                throw new Error('transient r2 write error');
            }
            return { ...job, ...patch };
        });
        (planSlides as any).mockResolvedValue(plan);
        (generateSlideImages as any).mockImplementation(
            async (_openai: any, _plan: any, _url: any, onSlide?: (n: number) => Promise<void>) => {
                await onSlide?.(1);
                return [Buffer.from('img')];
            }
        );
        (uploadBufferToR2 as any).mockResolvedValue('https://r2/slide-1.png');
        (uploadFromUrl as any).mockResolvedValue({ id: 'media-1', path: 'p' });
        (getLastScheduledPosts as any).mockResolvedValue([]);
        (getNextScheduleTime as any).mockReturnValue('2026-07-10T10:00:00Z');
        (createPost as any).mockResolvedValue('postiz-1');
        (createPostFromService as any).mockResolvedValue('convex-1');
        const res = mockRes();

        await runSlidePostJobHandler({ params: { jobId: 'job-1' }, body } as any, res);

        // Pipeline must complete successfully despite the failed progress write.
        expect(res.status).toHaveBeenCalledWith(200);
        const patches = (updateJob as any).mock.calls.map((c: any) => c[1]);
        expect(patches[patches.length - 1]).toMatchObject({ status: 'done' });
    });
});

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
