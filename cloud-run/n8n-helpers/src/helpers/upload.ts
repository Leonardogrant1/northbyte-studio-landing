import * as fs from 'fs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from '../lib/r2';

export async function uploadToR2(filePath: string, key: string): Promise<string> {
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: 'video/mp4',
    });

    await r2Client.send(command);

    // Return the public URL
    return `${R2_PUBLIC_URL}/${key}`;
}

export async function uploadBufferToR2(
    buffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });

    await r2Client.send(command);

    return `${R2_PUBLIC_URL}/${key}`;
}
