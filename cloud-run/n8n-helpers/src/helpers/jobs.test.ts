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
