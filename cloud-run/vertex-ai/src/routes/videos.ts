import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateVideo, getVideoOperationStatus, VideoGenerationRequest } from '../lib/videoGeneration.js';
import { logger } from '../lib/logger.js';

const router: ReturnType<typeof Router> = Router();

// Schema for image input (for image-to-video)
const imageInputSchema = z.object({
    bytesBase64Encoded: z.string().optional(),
    gcsUri: z.string().optional(),
    mimeType: z.string().optional(),
});

// Schema for reference images
const referenceImageSchema = z.object({
    image: imageInputSchema,
    referenceType: z.string().optional(),
});

// Main video generation schema matching Vertex AI Veo API
const videoGenerationSchema = z.object({
    // Required prompt
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long'),

    // Optional model
    model: z.string().optional(), // e.g., 'veo-3.1-generate-001', 'veo-3.1-fast-generate-001'

    // Optional parameters
    negativePrompt: z.string().max(5000).optional(),
    aspectRatio: z.enum(['16:9', '9:16']).optional().default('16:9'),
    durationSeconds: z.number().int().min(4).max(8).optional().default(8),
    sampleCount: z.number().int().min(1).max(4).optional().default(1),
    seed: z.number().int().min(0).max(4294967295).optional(),
    personGeneration: z.enum(['dont_allow', 'allow_adult', 'allow_all']).optional(),
    resolution: z.enum(['720p', '1080p', '4k']).optional(),
    compressionQuality: z.enum(['optimized', 'lossless']).optional().default('optimized'),
    enhancePrompt: z.boolean().optional(),
    generateAudio: z.boolean().optional(),
    storageUri: z.string().optional(),

    // Optional image inputs
    image: imageInputSchema.optional(),
    // Optional video input (for video extension/lengthening)
    video: z.object({
        gcsUri: z.string().optional(),
        mimeType: z.string().optional(),
    }).optional(),
    lastFrame: imageInputSchema.optional(),
    referenceImages: z.array(referenceImageSchema).max(3).optional(),
});

// Schema for checking operation status
const operationStatusSchema = z.object({
    operationName: z.string().min(1, 'Operation name is required'),
});

/**
 * POST /videos/generate
 * Initiates a video generation request
 * Returns an operation name that can be used to check status
 */
router.post('/generate', async (req: Request, res: Response, next) => {
    try {
        // Validate request body
        const validationResult = videoGenerationSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid request body',
                details: validationResult.error.errors,
            });
        }

        const params = validationResult.data;

        logger.info(
            {
                prompt: params.prompt.substring(0, 50),
                aspectRatio: params.aspectRatio,
                durationSeconds: params.durationSeconds,
                sampleCount: params.sampleCount,
            },
            'Video generation request received'
        );

        // Generate video (starts long-running operation)
        const result = await generateVideo(params as VideoGenerationRequest);

        res.json({
            success: true,
            operationName: result.operationName,
            message: 'Video generation started. Use the operation name to check status.',
            metadata: result.metadata,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Video generation endpoint error');
        next(error);
    }
});

/**
 * GET /videos/status/:operationName
 * Checks the status of a video generation operation
 * Returns the current status and videos if completed
 */
router.get('/status/*operationName', async (req: Request, res: Response, next) => {

    try {
        // Get the full operation name from the wildcard path
        const operationName = req.params.operationName;

        if (!operationName) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Operation name is required',
            });
        }

        logger.info(
            { operationName },
            'Video operation status request received'
        );

        // Handle both string and array cases
        const operationNameString = Array.isArray(operationName) 
            ? operationName.join('/') 
            : operationName;

        const status = await getVideoOperationStatus(operationNameString);

        res.json({
            success: true,
            ...status,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Video status endpoint error');
        next(error);
    }
});

/**
 * POST /videos/status
 * Alternative endpoint to check status via POST body
 */
router.post('/status', async (req: Request, res: Response, next) => {
    try {
        const validationResult = operationStatusSchema.safeParse(req.body);

        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid request body',
                details: validationResult.error.errors,
            });
        }

        const { operationName } = validationResult.data;

        logger.info(
            { operationName },
            'Video operation status request received (POST)'
        );

        const status = await getVideoOperationStatus(operationName);

        res.json({
            success: true,
            ...status,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Video status endpoint error');
        next(error);
    }
});

export { router as videosRouter };
