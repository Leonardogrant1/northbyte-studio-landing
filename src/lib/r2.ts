import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Validate required environment variables
const requiredEnvVars = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// Initialize R2 client (S3-compatible)
export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

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
    key: string,
    expiresIn: number = 600,
    contentType?: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ...(contentType && { ContentType: contentType }),
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return presignedUrl;
}

/**
 * Delete a file from R2
 * @param key - The object key (path) in the bucket
 */
export async function deleteR2Object(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });
    await r2Client.send(command);
}

/**
 * Get the public download URL for an uploaded file
 * @param key - The object key (path) in the bucket
 * @returns Public download URL
 */
export function getPublicUrl(key: string): string {
    // Ensure R2_PUBLIC_URL doesn't end with a slash and key doesn't start with one
    const baseUrl = R2_PUBLIC_URL.replace(/\/$/, "");
    const cleanKey = key.replace(/^\//, "");
    return `${baseUrl}/${cleanKey}`;
}
