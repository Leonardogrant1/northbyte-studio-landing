import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateImage, editImage, ImageGenerationRequest, ImageEditRequest } from '../lib/imageGeneration.js';
import { logger } from '../lib/logger.js';

const router: ReturnType<typeof Router> = Router();

// Schema for image generation
const imageGenerationSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required').max(5000, 'Prompt too long'),
    model: z.string().optional(), // e.g., 'imagegeneration@006', 'imagen-3.0-generate-001'
    negativePrompt: z.string().max(5000).optional(),
    numberOfImages: z.number().int().min(1).max(8).optional().default(4),
    aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:3', '3:4']).optional(),
    guidanceScale: z.number().min(0).max(500).optional(),
    seed: z.number().int().min(0).max(4294967295).optional(),
    addWatermark: z.boolean().optional().default(true),
    safetyFilterLevel: z.enum(['block_low_and_above', 'block_medium_and_above', 'block_only_high', 'block_none']).optional(),
    personGeneration: z.enum(['dont_allow', 'allow_adult', 'allow_all']).optional(),
    sampleImageSize: z.enum(['1K', '2K']).optional(),
    language: z.enum(['auto', 'en', 'zh', 'zh-CN', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es']).optional(),
    enhancePrompt: z.boolean().optional(),
    storageUri: z.string().optional(),
    outputMimeType: z.enum(['image/png', 'image/jpeg']).optional(),
    compressionQuality: z.number().int().min(0).max(100).optional(),
});

// Schema for reference image
const referenceImageSchema = z.object({
    referenceType: z.enum(['REFERENCE_TYPE_RAW', 'REFERENCE_TYPE_MASK', 'REFERENCE_TYPE_STYLE']),
    referenceId: z.number().int(),
    referenceImage: z.object({
        bytesBase64Encoded: z.string().optional(),
        gcsUri: z.string().optional(),
    }),
    maskImageConfig: z.object({
        maskMode: z.enum(['MASK_MODE_USER_PROVIDED', 'MASK_MODE_BACKGROUND', 'MASK_MODE_FOREGROUND', 'MASK_MODE_SEMANTIC']),
        maskDilation: z.number().optional(),
        segmentationClasses: z.array(z.number().int()).optional(),
    }).optional(),
});

// Schema for image editing
const imageEditSchema = z.object({
    prompt: z.string().max(5000).optional(),
    model: z.string().optional(), // e.g., 'imagen-3.0-capability-001'
    referenceImages: z.array(referenceImageSchema).min(1).max(2),
    editMode: z.enum(['EDIT_MODE_INPAINT_REMOVAL', 'EDIT_MODE_INPAINT_INSERTION', 'EDIT_MODE_BGSWAP', 'EDIT_MODE_OUTPAINT']).optional(),
    negativePrompt: z.string().max(5000).optional(),
    numberOfImages: z.number().int().min(1).max(8).optional().default(1),
    guidanceScale: z.number().int().min(0).max(500).optional(),
    baseSteps: z.number().int().min(16).max(75).optional(),
    seed: z.number().int().min(0).max(4294967295).optional(),
    addWatermark: z.boolean().optional().default(true),
    safetyFilterLevel: z.enum(['block_low_and_above', 'block_medium_and_above', 'block_only_high', 'block_none']).optional(),
    personGeneration: z.enum(['dont_allow', 'allow_adult', 'allow_all']).optional(),
    language: z.enum(['auto', 'en', 'zh', 'zh-CN', 'zh-TW', 'hi', 'ja', 'ko', 'pt', 'es']).optional(),
    storageUri: z.string().optional(),
    outputMimeType: z.enum(['image/png', 'image/jpeg']).optional(),
    compressionQuality: z.number().int().min(0).max(100).optional(),
});

/**
 * POST /images/generate
 * Generates images from text prompts
 */
router.post('/generate', async (req: Request, res: Response, next) => {
    try {
        // Validate request body
        const validationResult = imageGenerationSchema.safeParse(req.body);

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
                numberOfImages: params.numberOfImages,
                aspectRatio: params.aspectRatio,
            },
            'Image generation request received'
        );

        // Generate images
        const result = await generateImage(params as ImageGenerationRequest);

        res.json({
            success: true,
            images: result.images,
            metadata: result.metadata,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Image generation endpoint error');
        next(error);
    }
});

/**
 * POST /images/edit
 * Edits images using mask-based editing
 */
router.post('/edit', async (req: Request, res: Response, next) => {
    try {
        // Validate request body
        const validationResult = imageEditSchema.safeParse(req.body);

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
                editMode: params.editMode,
                referenceImageCount: params.referenceImages.length,
                numberOfImages: params.numberOfImages,
            },
            'Image editing request received'
        );

        // Edit image
        const result = await editImage(params as ImageEditRequest);

        res.json({
            success: true,
            images: result.images,
            metadata: result.metadata,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Image editing endpoint error');
        next(error);
    }
});

export { router as imagesRouter };

