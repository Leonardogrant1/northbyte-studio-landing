import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { downloadVideo } from '../helpers/download';
import { mergeVideos } from '../helpers/merge';
import { uploadToR2 } from '../helpers/upload';

const logger = pino();

export async function mergeVideosHandler(req: Request, res: Response) {
    const tempDir = path.join(os.tmpdir(), randomUUID());

    try {
        const { video_urls } = req.body;

        // Validation
        if (!video_urls || !Array.isArray(video_urls) || video_urls.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'video_urls must be a non-empty array of URLs',
                },
            });
        }

        logger.info(`Merging ${video_urls.length} videos`);

        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Download all videos
        const downloadedPaths: string[] = [];
        for (let i = 0; i < video_urls.length; i++) {
            const videoPath = path.join(tempDir, `video_${i}.mp4`);
            logger.info(`Downloading video ${i + 1}/${video_urls.length}: ${video_urls[i]}`);
            await downloadVideo(video_urls[i], videoPath);
            downloadedPaths.push(videoPath);
        }

        // Merge videos
        const outputPath = path.join(tempDir, 'merged.mp4');
        logger.info('Merging videos...');
        await mergeVideos(downloadedPaths, outputPath);

        // Upload to R2
        const r2Key = `merged-videos/${randomUUID()}.mp4`;
        logger.info(`Uploading to R2: ${r2Key}`);
        const downloadUrl = await uploadToR2(outputPath, r2Key);

        // Clean up temp files
        logger.info('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        logger.info(`Video merge completed successfully: ${downloadUrl}`);

        res.status(200).json({
            success: true,
            download_url: downloadUrl,
        });
    } catch (error: any) {
        logger.error({ error: error.message, stack: error.stack }, 'Error merging videos');

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
