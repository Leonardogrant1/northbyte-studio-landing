import { Request, Response, RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import pino from 'pino';
import multer, { FileFilterCallback } from 'multer';
import { downloadVideo } from '../helpers/download';
import { uploadToR2 } from '../helpers/upload';

const logger = pino();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        const tempDir = path.join(os.tmpdir(), randomUUID());
        fs.mkdirSync(tempDir, { recursive: true });
        // Store tempDir in request for cleanup
        (req as any).tempDir = tempDir;
        cb(null, tempDir);
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        // Keep original extension or default to .mp4
        const ext = path.extname(file.originalname) || '.mp4';
        cb(null, `video${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit
    },
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        // Accept video files
        const allowedMimes = [
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska',
            'video/webm'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed.'));
        }
    }
});

// Export multer middleware for use in routes
export const uploadMiddleware: RequestHandler = upload.single('video');

export async function storeVideoHandler(req: Request, res: Response) {
    const tempDir = (req as any).tempDir || path.join(os.tmpdir(), randomUUID());

    try {
        const { gcsUri, videoUrl } = req.body;
        const uploadedFile = req.file;

        // Validation - exactly one source must be provided
        const sources = [gcsUri, videoUrl, uploadedFile].filter(Boolean);
        if (sources.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Either gcsUri, videoUrl, or a video file must be provided',
                },
            });
        }

        if (sources.length > 1) {
            return res.status(400).json({
                error: {
                    message: 'Provide only one of: gcsUri, videoUrl, or a video file',
                },
            });
        }

        let videoPath: string;

        // Handle file upload
        if (uploadedFile) {
            logger.info(`Storing uploaded video file: ${uploadedFile.originalname}`);
            videoPath = uploadedFile.path;
        }
        // Handle GCS URI
        else if (gcsUri) {
            if (typeof gcsUri !== 'string') {
                return res.status(400).json({
                    error: {
                        message: 'gcsUri must be a valid string',
                    },
                });
            }

            if (!gcsUri.startsWith('gs://')) {
                return res.status(400).json({
                    error: {
                        message: 'gcsUri must start with gs://',
                    },
                });
            }

            logger.info(`Storing video from GCS: ${gcsUri}`);

            // Create temp directory if not already created by multer
            if (!(req as any).tempDir) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download video from GCS
            videoPath = path.join(tempDir, 'video.mp4');
            logger.info(`Downloading video from GCS: ${gcsUri}`);
            await downloadVideo(gcsUri, videoPath);
        }
        // Handle regular HTTP/HTTPS URL
        else if (videoUrl) {
            if (typeof videoUrl !== 'string') {
                return res.status(400).json({
                    error: {
                        message: 'videoUrl must be a valid string',
                    },
                });
            }

            if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
                return res.status(400).json({
                    error: {
                        message: 'videoUrl must start with http:// or https://',
                    },
                });
            }

            logger.info(`Storing video from URL: ${videoUrl}`);

            // Create temp directory if not already created by multer
            if (!(req as any).tempDir) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Download video from URL
            videoPath = path.join(tempDir, 'video.mp4');
            logger.info(`Downloading video from URL: ${videoUrl}`);
            await downloadVideo(videoUrl, videoPath);
        } else {
            // This should never happen due to earlier validation
            throw new Error('No video source provided');
        }

        // Upload to R2
        const r2Key = `videos/${randomUUID()}.mp4`;
        logger.info(`Uploading to R2: ${r2Key}`);
        const downloadUrl = await uploadToR2(videoPath, r2Key);

        // Clean up temp files
        logger.info('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        logger.info(`Video store completed successfully: ${downloadUrl}`);

        res.status(200).json({
            success: true,
            download_url: downloadUrl,
        });
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, 'Error storing video');

        // Clean up temp files on error
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }

        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
            },
        });
    }
}
