import axios from 'axios';
import { logger } from './logger.js';
import { getAccessToken, getProjectId } from './auth.js';

const projectId = getProjectId();
const location = process.env.GCP_LOCATION || 'us-central1';

export interface ImageGenerationRequest {
    prompt: string;
    model?: string; // Model ID (e.g., 'imagegeneration@006', 'imagen-3.0-generate-001')
    negativePrompt?: string;
    numberOfImages?: number;
    aspectRatio?: '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
    guidanceScale?: number;
    seed?: number;
    addWatermark?: boolean;
    safetyFilterLevel?: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high' | 'block_none';
    personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
    sampleImageSize?: '1K' | '2K';
    language?: 'auto' | 'en' | 'zh' | 'zh-CN' | 'zh-TW' | 'hi' | 'ja' | 'ko' | 'pt' | 'es';
    enhancePrompt?: boolean;
    storageUri?: string;
    outputMimeType?: 'image/png' | 'image/jpeg';
    compressionQuality?: number;
}

export interface ImageEditRequest {
    prompt?: string;
    model?: string; // Model ID (e.g., 'imagen-3.0-capability-001')
    referenceImages: Array<{
        referenceType: 'REFERENCE_TYPE_RAW' | 'REFERENCE_TYPE_MASK' | 'REFERENCE_TYPE_STYLE';
        referenceId: number;
        referenceImage: {
            bytesBase64Encoded?: string;
            gcsUri?: string;
        };
        maskImageConfig?: {
            maskMode: 'MASK_MODE_USER_PROVIDED' | 'MASK_MODE_BACKGROUND' | 'MASK_MODE_FOREGROUND' | 'MASK_MODE_SEMANTIC';
            maskDilation?: number;
            segmentationClasses?: number[];
        };
    }>;
    editMode?: 'EDIT_MODE_INPAINT_REMOVAL' | 'EDIT_MODE_INPAINT_INSERTION' | 'EDIT_MODE_BGSWAP' | 'EDIT_MODE_OUTPAINT';
    negativePrompt?: string;
    numberOfImages?: number;
    guidanceScale?: number;
    baseSteps?: number;
    seed?: number;
    addWatermark?: boolean;
    safetyFilterLevel?: 'block_low_and_above' | 'block_medium_and_above' | 'block_only_high' | 'block_none';
    personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
    language?: 'auto' | 'en' | 'zh' | 'zh-CN' | 'zh-TW' | 'hi' | 'ja' | 'ko' | 'pt' | 'es';
    storageUri?: string;
    outputMimeType?: 'image/png' | 'image/jpeg';
    compressionQuality?: number;
}

export interface ImageGenerationResponse {
    images: Array<{
        bytesBase64Encoded?: string;
        gcsUri?: string;
        mimeType: string;
        raiFilteredReason?: string;
        safetyAttributes?: {
            categories: string[];
            scores: number[];
        };
    }>;
    metadata?: any;
}

export async function generateImage(
    request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
    try {
        // Use model from request, default to imagen-4.0-fast-generate-001
        const model = request.model || 'imagen-4.0-fast-generate-001';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        logger.info(
            {
                endpoint,
                prompt: request.prompt.substring(0, 100),
                numberOfImages: request.numberOfImages || 4,
            },
            'Generating images'
        );

        // Build instance object
        const instance: any = {
            prompt: request.prompt,
        };

        // Build parameters object
        const parameters: any = {
            sampleCount: request.numberOfImages || 4,
        };

        // Add optional parameters
        if (request.aspectRatio) {
            parameters.aspectRatio = request.aspectRatio;
        }

        if (request.negativePrompt) {
            parameters.negativePrompt = request.negativePrompt;
        }

        if (request.guidanceScale !== undefined) {
            parameters.guidanceScale = request.guidanceScale;
        }

        if (request.seed !== undefined) {
            parameters.seed = request.seed;
        }

        if (request.addWatermark !== undefined) {
            parameters.addWatermark = request.addWatermark;
        }

        if (request.safetyFilterLevel) {
            parameters.safetySetting = request.safetyFilterLevel;
        }

        if (request.personGeneration) {
            parameters.personGeneration = request.personGeneration;
        }

        if (request.sampleImageSize) {
            parameters.sampleImageSize = request.sampleImageSize;
        }

        if (request.language) {
            parameters.language = request.language;
        }

        if (request.enhancePrompt !== undefined) {
            parameters.enhancePrompt = request.enhancePrompt;
        }

        if (request.storageUri) {
            parameters.storageUri = request.storageUri;
        }

        // Add output options if specified
        if (request.outputMimeType || request.compressionQuality !== undefined) {
            parameters.outputOptions = {};
            if (request.outputMimeType) {
                parameters.outputOptions.mimeType = request.outputMimeType;
            }
            if (request.compressionQuality !== undefined) {
                parameters.outputOptions.compressionQuality = request.compressionQuality;
            }
        }

        // Get access token
        const accessToken = await getAccessToken();

        // Make the request
        const response = await axios.post(
            endpoint,
            {
                instances: [instance],
                parameters,
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        logger.info(
            { imageCount: response.data.predictions?.length || 0 },
            'Image generation successful'
        );

        const images = response.data.predictions?.map((prediction: any) => ({
            bytesBase64Encoded: prediction.bytesBase64Encoded,
            gcsUri: prediction.gcsUri,
            mimeType: prediction.mimeType || 'image/png',
            raiFilteredReason: prediction.raiFilteredReason,
            safetyAttributes: prediction.safetyAttributes,
        })) || [];

        return {
            images,
            metadata: response.data.metadata,
        };
    } catch (error: any) {
        logger.error(
            {
                error: error.message,
                response: error.response?.data,
            },
            'Image generation failed'
        );
        throw error;
    }
}

export async function editImage(
    request: ImageEditRequest
): Promise<ImageGenerationResponse> {
    try {
        // Use model from request, default to imagen-4.0-fast-generate-001
        const model = request.model || 'imagen-4.0-fast-generate-001';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

        logger.info(
            {
                endpoint,
                editMode: request.editMode,
                referenceImageCount: request.referenceImages.length,
            },
            'Editing image'
        );

        // Build instance object
        const instance: any = {
            referenceImages: request.referenceImages,
        };

        if (request.prompt) {
            instance.prompt = request.prompt;
        }

        // Build parameters object
        const parameters: any = {
            sampleCount: request.numberOfImages || 1,
        };

        // Add required edit mode for mask editing
        if (request.editMode) {
            parameters.editMode = request.editMode;
        }

        // Add optional parameters
        if (request.negativePrompt) {
            parameters.negativePrompt = request.negativePrompt;
        }

        if (request.guidanceScale !== undefined) {
            parameters.guidanceScale = request.guidanceScale;
        }

        if (request.baseSteps !== undefined) {
            parameters.baseSteps = request.baseSteps;
        }

        if (request.seed !== undefined) {
            parameters.seed = request.seed;
        }

        if (request.addWatermark !== undefined) {
            parameters.addWatermark = request.addWatermark;
        }

        if (request.safetyFilterLevel) {
            parameters.safetySetting = request.safetyFilterLevel;
        }

        if (request.personGeneration) {
            parameters.personGeneration = request.personGeneration;
        }

        if (request.language) {
            parameters.language = request.language;
        }

        if (request.storageUri) {
            parameters.storageUri = request.storageUri;
        }

        // Add output options if specified
        if (request.outputMimeType || request.compressionQuality !== undefined) {
            parameters.outputOptions = {};
            if (request.outputMimeType) {
                parameters.outputOptions.mimeType = request.outputMimeType;
            }
            if (request.compressionQuality !== undefined) {
                parameters.outputOptions.compressionQuality = request.compressionQuality;
            }
        }

        // Get access token
        const accessToken = await getAccessToken();

        // Make the request
        const response = await axios.post(
            endpoint,
            {
                instances: [instance],
                parameters,
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        logger.info(
            { imageCount: response.data.predictions?.length || 0 },
            'Image editing successful'
        );

        const images = response.data.predictions?.map((prediction: any) => ({
            bytesBase64Encoded: prediction.bytesBase64Encoded,
            gcsUri: prediction.gcsUri,
            mimeType: prediction.mimeType || 'image/png',
            raiFilteredReason: prediction.raiFilteredReason,
            safetyAttributes: prediction.safetyAttributes,
        })) || [];

        return {
            images,
            metadata: response.data.metadata,
        };
    } catch (error: any) {
        logger.error(
            {
                error: error.message,
                response: error.response?.data,
            },
            'Image editing failed'
        );
        throw error;
    }
}
