import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { downloadVideo } from '../helpers/download';
import { overlayImagesOnVideo, OverlayOptions, ImageOverlay } from '../helpers/overlay';
import { uploadToR2 } from '../helpers/upload';

const logger = pino();

type OverlayImageRequest = {
    videoUrl: string;
    images: ImageOverlay[];
};

export async function overlayImageHandler(req: Request, res: Response) {
    const tempDir = path.join(os.tmpdir(), randomUUID());

    try {
        const { videoUrl, images } = req.body as OverlayImageRequest;

        // Validation
        if (!videoUrl || typeof videoUrl !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'videoUrl must be a valid string',
                },
            });
        }

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'images must be a non-empty array',
                },
            });
        }

        logger.info(`Overlaying ${images.length} image(s) on video`);
        logger.info(`Video: ${videoUrl}`);

        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Download video
        const inputVideoPath = path.join(tempDir, 'input.mp4');
        logger.info('Downloading video...');
        await downloadVideo(videoUrl, inputVideoPath);

        // Download all images
        const imagePaths: string[] = [];
        const overlayOptions: OverlayOptions[] = [];

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const imagePath = path.join(tempDir, `overlay_${i}.png`);

            logger.info(`Downloading image ${i + 1}/${images.length}: ${img.imageUrl}`);
            await downloadVideo(img.imageUrl, imagePath);

            imagePaths.push(imagePath);
            overlayOptions.push({
                startPercent: img.startPercent,
                endPercent: img.endPercent,
                position: img.position,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                opacity: img.opacity,
            });
        }

        // Overlay images
        const outputVideoPath = path.join(tempDir, 'output.mp4');
        logger.info('Overlaying images...');
        await overlayImagesOnVideo(inputVideoPath, imagePaths, outputVideoPath, overlayOptions);

        // Upload to R2
        const r2Key = `overlayed-videos/${randomUUID()}.mp4`;
        logger.info(`Uploading to R2: ${r2Key}`);
        const outputUrl = await uploadToR2(outputVideoPath, r2Key);

        // Clean up temp files
        logger.info('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        logger.info(`Image overlay completed successfully: ${outputUrl}`);

        res.status(200).json({
            outputUrl,
        });
    } catch (error: any) {
        logger.error('Error overlaying image:', error);

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
