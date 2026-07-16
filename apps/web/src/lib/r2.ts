import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2_BUCKETS } from "./r2-constants";

// Initialize R2 client (S3-compatible)
export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export const R2_PUBLIC_URLS = {
    [R2_BUCKETS.n8n]: process.env.R2_N8N_PUBLIC_URL!,
    [R2_BUCKETS.support]: process.env.R2_SUPPORT_PUBLIC_URL!,
    [R2_BUCKETS.northbyte]: process.env.R2_NORTHBYTE_PUBLIC_URL!,
};

/**
 * Generate a presigned URL for uploading a file to R2
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 600 = 10 minutes)
 * @param contentType - MIME type of the file (e.g. "video/mp4"). When provided,
 *   it is embedded in the signature — the client MUST send the same Content-Type
 *   header in the PUT request, and R2 will store it as the object's metadata.
 * @returns Presigned URL for PUT request
 */
export async function generatePresignedUploadUrl(
    bucket: R2_BUCKETS,
    key: string,
    expiresIn: number = 600,
    contentType?: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(contentType && { ContentType: contentType }),
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return presignedUrl;
}

/**
 * Generate a presigned URL for downloading a file from R2
 * @param bucket - The R2 bucket
 * @param key - The object key (path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
 * @param fileName - If provided, sets Content-Disposition to force download with this name
 */
export async function generatePresignedDownloadUrl(
    bucket: R2_BUCKETS,
    key: string,
    expiresIn: number = 300,
    fileName?: string
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(fileName && { ResponseContentDisposition: `attachment; filename="${fileName}"` }),
    });

    return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete a file from R2
 * @param key - The object key (path) in the bucket
 */
export async function deleteR2Object(
    bucket: R2_BUCKETS,
    key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await r2Client.send(command);
}

/**
 * Get the public download URL for an uploaded file
 * @param key - The object key (path) in the bucket
 * @returns Public download URL
 */
export function getPublicUrl(bucket: R2_BUCKETS, key: string): string {
    const baseUrl = R2_PUBLIC_URLS[bucket]?.replace(/\/$/, "");
    if (!baseUrl) {
        throw new Error(`No public URL configured for bucket "${bucket}" — set the corresponding env var (e.g. R2_NORTHBYTE_PUBLIC_URL).`);
    }
    const cleanKey = key.replace(/^\//, "");
    return `${baseUrl}/${cleanKey}`;
}
