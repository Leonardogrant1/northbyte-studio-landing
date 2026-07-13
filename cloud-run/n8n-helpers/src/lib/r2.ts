import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || '',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';

/** Ensures the public URL always carries a scheme and has no trailing slash. */
export function normalizePublicUrl(value: string): string {
    if (!value) return value;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return withScheme.replace(/\/+$/, '');
}

export const R2_PUBLIC_URL = normalizePublicUrl(process.env.R2_PUBLIC_URL || '');
