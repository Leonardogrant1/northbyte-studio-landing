import * as fs from 'fs';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';

/**
 * Parses a GCS URI (gs://bucket/path) into bucket name and file path
 */
function parseGcsUri(uri: string): { bucketName: string; fileName: string } | null {
    if (!uri.startsWith('gs://')) {
        return null;
    }

    const withoutPrefix = uri.substring(5); // Remove 'gs://'
    const firstSlash = withoutPrefix.indexOf('/');

    if (firstSlash === -1) {
        throw new Error(`Invalid GCS URI: ${uri}. Expected format: gs://bucket/path/to/file`);
    }

    const bucketName = withoutPrefix.substring(0, firstSlash);
    const fileName = withoutPrefix.substring(firstSlash + 1);

    return { bucketName, fileName };
}

/**
 * Initializes Google Cloud Storage client with service account credentials
 */
function getStorageClient(): Storage {
    const serviceAccountB64 = process.env.SERVICE_ACCOUNT_B64;

    if (!serviceAccountB64) {
        throw new Error('SERVICE_ACCOUNT_B64 environment variable is required for GCS access');
    }

    try {
        // Decode base64 service account key
        const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('utf-8');
        const credentials = JSON.parse(serviceAccountJson);

        // Initialize Storage with credentials
        return new Storage({
            credentials,
        });
    } catch (error: any) {
        throw new Error('Failed to initialize GCS Storage: ' + error.message);
    }
}

/**
 * Downloads a file from Google Cloud Storage to a local file
 */
async function downloadFromGcsToFile(
    bucketName: string,
    fileName: string,
    outputPath: string
): Promise<void> {
    const storage = getStorageClient();
    await storage.bucket(bucketName).file(fileName).download({
        destination: outputPath,
    });
}

/**
 * Downloads a file from Google Cloud Storage to a buffer in memory
 */
async function downloadFromGcsToBuffer(
    bucketName: string,
    fileName: string
): Promise<Buffer> {
    const storage = getStorageClient();
    const [contents] = await storage.bucket(bucketName).file(fileName).download();
    return contents;
}

/**
 * Reads error message from a stream
 */
async function readErrorFromStream(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
            try {
                const errorBody = Buffer.concat(chunks).toString('utf-8');
                // Try to parse as JSON for better error message
                try {
                    const errorJson = JSON.parse(errorBody);
                    resolve(JSON.stringify(errorJson, null, 2));
                } catch {
                    resolve(errorBody || 'Unknown error');
                }
            } catch (err) {
                resolve('Failed to read error message from stream');
            }
        });
        stream.on('error', (err: Error) => reject(err));
    });
}

/**
 * Downloads a video from either HTTP/HTTPS URL or GCS URI to a local file
 */
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
    // Check if it's a GCS URI
    const gcsInfo = parseGcsUri(url);
    if (gcsInfo) {
        await downloadFromGcsToFile(gcsInfo.bucketName, gcsInfo.fileName, outputPath);
        return;
    }

    // Otherwise, treat it as HTTP/HTTPS URL
    try {
        const writer = fs.createWriteStream(outputPath);

        // Prepare headers - add Gemini API key only for Google Generative Language API
        const headers: Record<string, string> = {};
        if (url.includes('generativelanguage.googleapis') && process.env.GEMINI_API_KEY) {
            headers['x-goog-api-key'] = process.env.GEMINI_API_KEY;
        }

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers,
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
            response.data.on('error', reject);
        });
    } catch (error: any) {
        // If axios error with response stream, read the error message
        if (error.response && error.response.data && typeof error.response.data.on === 'function') {
            const errorMessage = await readErrorFromStream(error.response.data);
            throw new Error(
                `Failed to download video from ${url}: HTTP ${error.response.status} ${error.response.statusText}\n${errorMessage}`
            );
        }
        // Re-throw with better context
        throw new Error(`Failed to download video from ${url}: ${error.message}`);
    }
}

/**
 * Downloads a video from either HTTP/HTTPS URL or GCS URI to a buffer in memory
 */
export async function downloadVideoToBuffer(url: string): Promise<Buffer> {
    // Check if it's a GCS URI
    const gcsInfo = parseGcsUri(url);
    if (gcsInfo) {
        return await downloadFromGcsToBuffer(gcsInfo.bucketName, gcsInfo.fileName);
    }

    // Otherwise, treat it as HTTP/HTTPS URL
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        headers: url.includes('generativelanguage.googleapis') && process.env.GEMINI_API_KEY
            ? { 'x-goog-api-key': process.env.GEMINI_API_KEY }
            : {},
    });

    return Buffer.from(response.data);
}
