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
