import axios, { AxiosResponse } from 'axios';
import { logger } from './logger.js';
import { getAccessToken, getProjectId } from './auth.js';

const projectId = getProjectId();
const location = process.env.GCP_LOCATION || 'us-central1';

export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string; // base64 encoded
    };
    fileData?: {
        mimeType: string;
        fileUri: string; // gs:// URI
    };
}

export interface Content {
    role?: 'user' | 'model';
    parts: Part[];
}

export interface GenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
}

export interface SafetySetting {
    category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
    threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

export interface GeminiGenerateRequest {
    model?: string; // e.g., 'gemini-2.5-flash', 'gemini-2.0-flash-001'
    contents: Content[];
    generationConfig?: GenerationConfig;
    safetySettings?: SafetySetting[];
    systemInstruction?: {
        parts: Part[];
    };
}

export interface GeminiGenerateResponse {
    candidates: Array<{
        content: Content;
        finishReason?: string;
        safetyRatings?: Array<{
            category: string;
            probability: string;
        }>;
        tokenCount?: number;
    }>;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

/**
 * Transform camelCase to snake_case for Vertex AI API
 */
function toSnakeCase(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(toSnakeCase);
    }
    
    if (typeof obj !== 'object') {
        return obj;
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = toSnakeCase(value);
    }
    return result;
}

/**
 * Generates content using Gemini model via Vertex AI Inference API
 */
export async function generateContent(
    request: GeminiGenerateRequest
): Promise<GeminiGenerateResponse> {
    try {
        // Use model from request, default to gemini-2.5-flash
        const model = request.model || 'gemini-2.5-flash';
        const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        logger.info(
            {
                endpoint,
                model,
                contentCount: request.contents.length,
            },
            'Generating content with Gemini'
        );

        // Build request body (Vertex AI API expects snake_case)
        const requestBody: any = {
            contents: request.contents.map(content => ({
                ...(content.role && { role: content.role }),
                parts: content.parts.map(part => {
                    const transformed: any = {};
                    if (part.text) transformed.text = part.text;
                    if (part.inlineData) {
                        transformed.inline_data = {
                            mime_type: part.inlineData.mimeType,
                            data: part.inlineData.data,
                        };
                    }
                    if (part.fileData) {
                        transformed.file_data = {
                            mime_type: part.fileData.mimeType,
                            file_uri: part.fileData.fileUri,
                        };
                    }
                    return transformed;
                }),
            })),
        };

        if (request.generationConfig) {
            requestBody.generation_config = toSnakeCase(request.generationConfig);
        }

        if (request.safetySettings) {
            requestBody.safety_settings = request.safetySettings.map(setting => ({
                category: setting.category,
                threshold: setting.threshold,
            }));
        }

        if (request.systemInstruction) {
            requestBody.system_instruction = {
                parts: request.systemInstruction.parts.map(part => {
                    const transformed: any = {};
                    if (part.text) transformed.text = part.text;
                    if (part.inlineData) {
                        transformed.inline_data = {
                            mime_type: part.inlineData.mimeType,
                            data: part.inlineData.data,
                        };
                    }
                    if (part.fileData) {
                        transformed.file_data = {
                            mime_type: part.fileData.mimeType,
                            file_uri: part.fileData.fileUri,
                        };
                    }
                    return transformed;
                }),
            };
        }

        // Get access token
        const accessToken = await getAccessToken();
 
        console.log("endpoint", endpoint);

        // Make the request
        const response: AxiosResponse<GeminiGenerateResponse> = await axios.post(
            endpoint,
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Full response:', JSON.stringify(response.data, null, 2));

        logger.info(
            { 
                candidateCount: response.data.candidates?.length || 0,
                totalTokenCount: response.data.usageMetadata?.totalTokenCount,
            },
            'Content generation successful'
        );

        return response.data;
    } catch (error: any) { 
        logger.error(
            {
                error: error.response?.data?.error?.message || error.message,
                response: error.response?.data,
            },
            'Content generation failed'
        );
        throw error;
    }
}

/**
 * Streams content generation using Gemini model via Vertex AI Inference API
 */
export async function* streamGenerateContent(
    request: GeminiGenerateRequest
): AsyncGenerator<GeminiGenerateResponse, void, unknown> {
    try {
        // Use model from request, default to gemini-2.5-flash
        const model = request.model || 'gemini-2.5-flash';
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent`;

        logger.info(
            {
                endpoint,
                model,
                contentCount: request.contents.length,
            },
            'Streaming content generation with Gemini'
        );

        // Build request body (Vertex AI API expects snake_case)
        const requestBody: any = {
            contents: request.contents.map(content => ({
                role: content.role,
                parts: content.parts.map(part => {
                    const transformed: any = {};
                    if (part.text) transformed.text = part.text;
                    if (part.inlineData) {
                        transformed.inline_data = {
                            mime_type: part.inlineData.mimeType,
                            data: part.inlineData.data,
                        };
                    }
                    if (part.fileData) {
                        transformed.file_data = {
                            mime_type: part.fileData.mimeType,
                            file_uri: part.fileData.fileUri,
                        };
                    }
                    return transformed;
                }),
            })),
        };

        if (request.generationConfig) {
            requestBody.generation_config = toSnakeCase(request.generationConfig);
        }

        if (request.safetySettings) {
            requestBody.safety_settings = request.safetySettings.map(setting => ({
                category: setting.category,
                threshold: setting.threshold,
            }));
        }

        if (request.systemInstruction) {
            requestBody.system_instruction = {
                parts: request.systemInstruction.parts.map(part => {
                    const transformed: any = {};
                    if (part.text) transformed.text = part.text;
                    if (part.inlineData) {
                        transformed.inline_data = {
                            mime_type: part.inlineData.mimeType,
                            data: part.inlineData.data,
                        };
                    }
                    if (part.fileData) {
                        transformed.file_data = {
                            mime_type: part.fileData.mimeType,
                            file_uri: part.fileData.fileUri,
                        };
                    }
                    return transformed;
                }),
            };
        }

        // Get access token
        const accessToken = await getAccessToken();

        // Make the streaming request
        const response = await axios.post(
            endpoint,
            requestBody,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'stream',
            }
        );

        // Parse streaming response
        let buffer = '';
        for await (const chunk of response.data) {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.trim() === '') continue;
                
                // Vertex AI streaming responses are in format: data: {...}
                if (line.startsWith('data: ')) {
                    try {
                        const jsonStr = line.substring(6); // Remove 'data: ' prefix
                        const data = JSON.parse(jsonStr);
                        yield data as GeminiGenerateResponse;
                    } catch (parseError) {
                        logger.warn({ line, parseError }, 'Failed to parse streaming chunk');
                    }
                }
            }
        }

        // Process remaining buffer
        if (buffer.trim()) {
            if (buffer.startsWith('data: ')) {
                try {
                    const jsonStr = buffer.substring(6);
                    const data = JSON.parse(jsonStr);
                    yield data as GeminiGenerateResponse;
                } catch (parseError) {
                    logger.warn({ buffer, parseError }, 'Failed to parse final streaming chunk');
                }
            }
        }

        logger.info('Content streaming completed');
    } catch (error: any) {
        logger.error(
            {
                error: error.message,
                response: error.response?.data,
            },
            'Content streaming failed'
        );
        throw error;
    }
}
