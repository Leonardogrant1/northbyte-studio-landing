import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import pino from 'pino';
import { downloadAssFile, parseAssFile, extractDialogText, updateDialogueText, generateAssFile, saveAssFile } from '../helpers/ass';
import { adjustSubtitleText, areTextsSimilar } from '../helpers/ai';
import { uploadToR2 } from '../helpers/upload';

const logger = pino();

type SubtitleAdjustRequest = {
    assUrl: string;
    dialogText: string;
};

export async function adjustSubtitleHandler(req: Request, res: Response) {
    const tempDir = path.join(os.tmpdir(), randomUUID());

    try {
        const { assUrl, dialogText } = req.body as SubtitleAdjustRequest;

        // Validation
        if (!assUrl || typeof assUrl !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'assUrl must be a valid string',
                },
            });
        }

        if (!dialogText || typeof dialogText !== 'string') {
            return res.status(400).json({
                error: {
                    message: 'dialogText must be a valid string',
                },
            });
        }

        logger.info(`Adjusting subtitle from: ${assUrl}`);

        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Download ASS file
        logger.info('Downloading ASS file...');
        const assContent = await downloadAssFile(assUrl);

        console.log('Downloaded ASS file content:', assContent);
        // Parse ASS file
        logger.info('Parsing ASS file...');
        const assFile = parseAssFile(assContent);

        // Extract dialog text
        const originalDialog = extractDialogText(assFile);
        logger.info(`Extracted ${assFile.dialogues.length} dialogue lines`);

        // Check if adjustment is needed
        const needsAdjustment = !areTextsSimilar(originalDialog, dialogText);

        let finalAssContent: string;

        if (needsAdjustment) {
            logger.info('Dialog differs from target, using AI to adjust...');

            // Use AI to adjust subtitle text
            const adjustedTexts = await adjustSubtitleText(originalDialog, dialogText);

            // Update ASS file with adjusted text
            const updatedAssFile = updateDialogueText(assFile, adjustedTexts);
            finalAssContent = generateAssFile(updatedAssFile);

            logger.info('Subtitle text adjusted by AI');
        } else {
            logger.info('Dialog matches target, no adjustment needed');
            finalAssContent = assContent;
        }

        // Save to temp file
        const outputPath = path.join(tempDir, 'adjusted.ass');
        saveAssFile(finalAssContent, outputPath);

        // Upload to R2
        const r2Key = `subtitles/${randomUUID()}.ass`;
        logger.info(`Uploading to R2: ${r2Key}`);

        // Temporarily modify uploadToR2 to handle ASS files
        const fileContent = fs.readFileSync(outputPath);
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } = await import('../lib/r2');

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            Body: fileContent,
            ContentType: 'text/plain',
        });

        await r2Client.send(command);
        const downloadUrl = `${R2_PUBLIC_URL}/${r2Key}`;

        // Clean up temp files
        logger.info('Cleaning up temporary files...');
        fs.rmSync(tempDir, { recursive: true, force: true });

        logger.info(`Subtitle adjustment completed: ${downloadUrl}`);

        res.status(200).json({
            downloadUrl,
            adjusted: needsAdjustment,
        });
    } catch (error: any) {
        logger.error('Error adjusting subtitle:', error);

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
