import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { downloadVideo } from '../helpers/download';
import { renderCaptionOnVideo } from '../helpers/caption';
import { uploadToR2 } from '../helpers/upload';

const logger = pino();

type CaptionRequest = {
    videoUrl: string;
    caption: string;
    options?: {
        isPng?: boolean;
    };
};

export async function renderCaptionHandler(req: Request, res: Response) {
    const tempDir = path.join(os.tmpdir(), randomUUID());

    try {
        const { videoUrl, caption, options } = req.body as CaptionRequest;

        // Validation
        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'videoUrl must be a valid string',
                },
            });
        }

        if (!caption || typeof caption !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'caption must be a valid string',
                },
            });
        }

        const isPng = options?.isPng !== false; // Default to PNG if not specified

        logger.info(`Rendering caption on video (isPng: ${isPng})`);

        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Download video
        const inputVideoPath = path.join(tempDir, 'input.mp4');
        logger.info(`Downloading video: ${videoUrl}`);
        await downloadVideo(videoUrl, inputVideoPath);

        // Render caption
        const outputVideoPath = path.join(tempDir, 'output.mp4');
        logger.info('Rendering caption...');
        await renderCaptionOnVideo(inputVideoPath, caption, outputVideoPath, isPng);

        // Upload to R2
        const r2Key = `captioned-videos/${randomUUID()}.mp4`;
        logger.info(`Uploading to R2: ${r2Key}`);
        const outputUrl = await uploadToR2(outputVideoPath, r2Key);

        // Clean up temp files
        logger.info('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        logger.info(`Caption rendering completed successfully: ${outputUrl}`);

        res.status(200).json({
            outputUrl,
        });
    } catch (error: any) {
        logger.error('Error rendering caption:', error);

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
