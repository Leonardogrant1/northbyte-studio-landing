import axios from 'axios';
import { logger } from './logger.js';
import { getAccessToken, getProjectId } from './auth.js';
import { parseOperationName } from 'src/helpers/parseOperationName.js';

const projectId = getProjectId();
const location = process.env.GCP_LOCATION || 'us-central1';

export interface VideoGenerationRequest {
    prompt: string;
    model?: string; // Model ID (e.g., 'veo-3.1-generate-001')
    negativePrompt?: string;
    aspectRatio?: '16:9' | '9:16';
    durationSeconds?: number;
    sampleCount?: number;
    seed?: number;
    personGeneration?: 'dont_allow' | 'allow_adult' | 'allow_all';
    resolution?: '720p' | '1080p' | '4k';
    compressionQuality?: 'optimized' | 'lossless';
    enhancePrompt?: boolean;
    generateAudio?: boolean;
    storageUri?: string;
    // Optional image input for image-to-video
    image?: {
        bytesBase64Encoded?: string;
        gcsUri?: string;
        mimeType?: string;
    };
    // Optional video input for video extension/lengthening
    video?: {
        gcsUri?: string;
        mimeType?: string;
    };
    // Optional last frame for video interpolation
    lastFrame?: {
        bytesBase64Encoded?: string;
        gcsUri?: string;
        mimeType?: string;
    };
    // Optional reference images (up to 3)
    referenceImages?: Array<{
        image: {
            bytesBase64Encoded?: string;
            gcsUri?: string;
            mimeType?: string;
        };
        referenceType?: string;
    }>;
}

export interface VideoGenerationResponse {
    operationName: string;
    metadata?: any;
}

export interface VideoOperationStatus {
    name: string;
    done: boolean;
    response?: {
        videos?: Array<{
            gcsUri?: string;
            bytesBase64Encoded?: string;
            mimeType?: string;
        }>;
        raiMediaFilteredCount?: number;
        raiMediaFilteredReasons?: string[];
    };
    error?: any;
    metadata?: any;
}

export async function generateVideo(
    request: VideoGenerationRequest
): Promise<VideoGenerationResponse> {
    try {
        // Use model from request, default to veo-3.1-generate-001
        const model = request.model || 'veo-3.1-generate-001';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

        logger.info(
            {
                endpoint,
                prompt: request.prompt.substring(0, 100),
                duration: request.durationSeconds,
                aspectRatio: request.aspectRatio || '16:9',
            },
            'Generating video'
        );

        // Build instance object
        const instance: any = {
            prompt: request.prompt,
        };

        // Add optional image inputs
        if (request.image) {
            instance.image = request.image;
        }

        // Add optional video input (for video extension/lengthening)
        if (request.video) {
            instance.video = request.video;
        }

        if (request.lastFrame) {
            instance.lastFrame = request.lastFrame;
        }

        if (request.referenceImages && request.referenceImages.length > 0) {
            instance.referenceImages = request.referenceImages;
        }

        // Build parameters object
        const parameters: any = {
            durationSeconds: request.durationSeconds || 8,
            aspectRatio: request.aspectRatio || '16:9',
            sampleCount: request.sampleCount || 1,
        };

        // Add optional parameters
        if (request.negativePrompt) {
            parameters.negativePrompt = request.negativePrompt;
        }

        if (request.seed !== undefined) {
            parameters.seed = request.seed;
        }

        parameters.personGeneration = request.personGeneration || 'allow_all';
       

        if (request.resolution) {
            parameters.resolution = request.resolution;
        }

        if (request.compressionQuality) {
            parameters.compressionQuality = request.compressionQuality;
        }

        if (request.enhancePrompt !== undefined) {
            parameters.enhancePrompt = request.enhancePrompt;
        }

        if (request.generateAudio !== undefined) {
            parameters.generateAudio = request.generateAudio;
        }

        const videoId = crypto.randomUUID();
        parameters.storageUri = `gs://northbyte-n8n-veo-videos/videos/${videoId}/`;
        

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
            { operationName: response.data.name },
            'Video generation operation started'
        );

        return {
            operationName: response.data.name || '',
            metadata: response.data.metadata,
        };
    } catch (error: any) {
        logger.error(
            {
                error: error.message,
                response: error.response?.data,
            },
            'Video generation failed'
        );
        throw error;
    }
}

export async function getVideoOperationStatus(
    operationName: string
): Promise<VideoOperationStatus> {
    try {
        logger.info({ operationName }, 'Checking video operation status');

          
  
  const { projectId, modelId, location, operationId } = parseOperationName(operationName);

        // Get access token
        const accessToken = await getAccessToken();

        // Make the request to get operation status
        const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

        const response = await axios.post(endpoint, 
            {
                "operationName": operationName
            },
             {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        const operation = response.data;

        const status: VideoOperationStatus = {
            name: operation.name || '',
            done: operation.done || false,
        };

        if (operation.error) {
            status.error = {
                code: operation.error.code,
                message: operation.error.message,
            };
        }

        if (operation.response) {
            status.response = {
                videos: operation.response.videos || [],
                raiMediaFilteredCount: operation.response.raiMediaFilteredCount,
                raiMediaFilteredReasons: operation.response.raiMediaFilteredReasons,
            };
        }

        if (operation.metadata) {
            status.metadata = operation.metadata;
        }

        logger.info(
            {
                operationName,
                done: status.done,
                hasError: !!status.error,
                videoCount: status.response?.videos?.length || 0,
            },
            'Video operation status retrieved'
        );

        return status;
    } catch (error: any) {
        logger.error(
            {
                error: error.message,
                operationName,
                response: error.response?.data,
            },
            'Failed to get video operation status'
        );
        throw error;
    }
}

