import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { generateContent, streamGenerateContent, GeminiGenerateRequest, Content, Part, GenerationConfig, SafetySetting } from '../lib/gemini.js';
import { logger } from '../lib/logger.js';

const router: ReturnType<typeof Router> = Router();

// Schema for Part (accepts snake_case as per Vertex AI API)
const partSchema = z.object({
    text: z.string().optional(),
    inline_data: z.object({
        mime_type: z.string(),
        data: z.string(), // base64 encoded
    }).optional(),
    file_data: z.object({
        mime_type: z.string(),
        file_uri: z.string(), // gs:// URI
    }).optional(),
}).refine(
    (data) => {
        return data.text || data.inline_data || data.file_data;
    },
    { message: 'At least one of text, inline_data, or file_data must be provided' }
);

// Schema for Content
const contentSchema = z.object({
    role: z.enum(['user', 'model']).optional(),
    parts: z.array(partSchema).min(1, 'At least one part is required'),
});

// Schema for GenerationConfig
const generationConfigSchema = z.object({
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().min(1).max(40).optional(),
    maxOutputTokens: z.number().int().min(1).max(8192).optional(),
    candidateCount: z.number().int().min(1).max(8).optional(),
    stopSequences: z.array(z.string()).optional(),
});

// Schema for SafetySetting
const safetySettingSchema = z.object({
    category: z.enum(['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']),
    threshold: z.enum(['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE']),
});

// Schema for system instruction
const systemInstructionSchema = z.object({
    parts: z.array(partSchema).min(1),
});

// Main schema for generate request
const generateRequestSchema = z.object({
    model: z.string().optional(), // e.g., 'gemini-2.5-flash', 'gemini-2.0-flash-001'
    contents: z.array(contentSchema).min(1, 'At least one content is required'),
    generationConfig: generationConfigSchema.optional(),
    safetySettings: z.array(safetySettingSchema).optional(),
    systemInstruction: systemInstructionSchema.optional(),
    stream: z.boolean().optional().default(false),
});

/**
 * POST /gemini/generate
 * Generates content using Gemini model
 * Supports both regular and streaming responses
 */
router.post('/generate', async (req: Request, res: Response, next) => {
    try {
        // Validate request body
        const validationResult = generateRequestSchema.safeParse(req.body);

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
                model: params.model || 'gemini-2.5-flash',
                contentCount: params.contents.length,
                stream: params.stream,
            },
            'Gemini generation request received'
        );

        // Transform snake_case from API request to camelCase for internal types
        const transformPart = (part: any): Part => {
            const transformed: Part = {};
            if (part.text) transformed.text = part.text;
            if (part.inline_data) {
                transformed.inlineData = {
                    mimeType: part.inline_data.mime_type,
                    data: part.inline_data.data,
                };
            }
            if (part.file_data) {
                transformed.fileData = {
                    mimeType: part.file_data.mime_type,
                    fileUri: part.file_data.file_uri,
                };
            }
            return transformed;
        };

        const transformContents = (contents: any[]): Content[] => {
            return contents.map(content => ({
                role: content.role,
                parts: content.parts.map(transformPart),
            }));
        };

        const request: GeminiGenerateRequest = {
            model: params.model,
            contents: transformContents(params.contents),
            generationConfig: params.generationConfig as GenerationConfig | undefined,
            safetySettings: params.safetySettings as SafetySetting[] | undefined,
            systemInstruction: params.systemInstruction ? {
                parts: params.systemInstruction.parts.map(transformPart),
            } : undefined,
        };

        // Handle streaming
        if (params.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            try {
                for await (const chunk of streamGenerateContent(request)) {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
                res.write('data: [DONE]\n\n');
                res.end();
            } catch (error: any) {
                logger.error({ error: error.message }, 'Streaming error');
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
            return;
        }

        // Regular (non-streaming) response
        const result = await generateContent(request);

        res.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        logger.error({ error: error.message }, 'Gemini generation endpoint error');
        next(error);
    }
});

export { router as geminiRouter };
