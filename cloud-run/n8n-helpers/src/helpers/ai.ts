import OpenAI from 'openai';
import pino from 'pino';

const logger = pino();

/**
 * Initializes OpenAI client
 */
function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    return new OpenAI({ apiKey });
}

/**
 * Compares original subtitle text with target dialog and adjusts if necessary
 */
export async function adjustSubtitleText(
    originalText: string,
    targetDialog: string
): Promise<string[]> {
    const openai = getOpenAIClient();

    const prompt = `You are a subtitle adjustment assistant. You need to adjust subtitle text to match a target dialog while preserving the subtitle structure.

Original subtitle text (one line per subtitle):
${originalText}

Target dialog text:
${targetDialog}

Instructions:
1. Compare the original subtitle text with the target dialog
2. If they are already very similar (minor differences only), return the original text unchanged
3. If there are significant differences, adjust the subtitle lines to match the target dialog
4. Preserve the number of subtitle lines (one per line)
5. Keep subtitle timing appropriate (don't make lines too long)
6. Return ONLY the adjusted subtitle lines, one per line, nothing else
7. Do not include any explanations, markdown formatting, or additional text

Return the adjusted subtitle lines now:`;

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'You are a subtitle adjustment assistant. Return only the adjusted subtitle lines, one per line, without any additional formatting or explanation.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
        });

        const text = completion.choices[0]?.message?.content?.trim() || '';

        // Split by newlines and filter empty lines
        const adjustedLines = text.split('\n').filter((line: string) => line.trim().length > 0);

        logger.info(`AI adjusted ${adjustedLines.length} subtitle lines`);
        return adjustedLines;
    } catch (error: any) {
        logger.error('Error calling OpenAI:', error);
        throw new Error(`Failed to adjust subtitle text: ${error.message}`);
    }
}

/**
 * Checks if two texts are similar enough (simple comparison)
 */
export function areTextsSimilar(text1: string, text2: string): boolean {
    const normalize = (text: string) =>
        text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);

    // Simple similarity check: if normalized texts are identical or very close
    if (normalized1 === normalized2) {
        return true;
    }

    // Calculate simple similarity ratio
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
    const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;

    if (longer.length === 0) {
        return true;
    }

    const similarity = shorter.length / longer.length;
    return similarity > 0.9; // 90% similarity threshold
}
