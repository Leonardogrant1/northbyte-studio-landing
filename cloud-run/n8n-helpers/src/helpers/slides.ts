import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import pino from 'pino';
import { AiAvatar } from '../lib/convex';

const logger = pino();

const TEXT_MODEL = 'gpt-5.5';
const IMAGE_MODEL = 'gpt-5.5';
export const SLIDE_COUNT = 4;

// Wird relativ zum Service-Ordner aufgelöst (Dev: pnpm dev, Docker: WORKDIR)
const STORE_ENTRY_PATH = path.join('src', 'assets', 'store_entry.png');

const APP_CONTEXT = `Die App "jemp" erstellt athletische Trainingspläne für Athleten,
die ihre Athletik verbessern wollen: Sprungkraft, Explosivität, Kraft und Mobilität.`;

export interface Slide {
    text: string;
    sceneDescription: string;
}

export interface SlidePlan {
    caption: string;
    slides: Slide[];
}

export function getOpenAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
    }
    return new OpenAI({ apiKey });
}

export async function planSlides(
    openai: OpenAI,
    topic: string,
    avatar: AiAvatar
): Promise<SlidePlan> {
    const systemPrompt = `Du bist Content-Stratege für organische TikTok-Slide-Posts.

${APP_CONTEXT}

Die Slides zeigen den Creator "${avatar.name}": ${avatar.description}.
Der Content muss wie authentischer, organischer Creator-Content wirken — kein Werbe-Look.

Erstelle einen Slide-Post mit genau ${SLIDE_COUNT} Slides zum Thema des Users:
- Slide 1: Ein kurzer, scroll-stoppender Hook (max. 100 Zeichen).
- Slides 2-3: Der komplette Inhalt, konkret und wertvoll (je max. 220 Zeichen).
  Bei Listen-Themen dürfen mehrere Punkte auf einer Slide stehen.
- Slide 4: Reiner Call-to-Action für die App "JEMP" nach diesem Muster, ans Thema
  und den Sport angepasst: "Wenn du einen athletischen Plan für dich und deinen
  Sport haben willst, lade dir die JEMP App herunter" (max. 160 Zeichen).
  Unter dem CTA-Text wird der App-Store-Eintrag der App eingeblendet — der Text
  muss also nicht erklären, wo man die App findet.

Pro Slide lieferst du:
- "text": Der deutsche Text, der als Overlay auf der Slide steht (du-Form, kurz, TikTok-Ton).
- "sceneDescription": Die Bildszene mit dem Creator (englisch, für die Bildgenerierung) —
  was er tut, Ort, Stimmung. Passend zum Slide-Text, athletischer Kontext.

Zusätzlich "caption": Die TikTok-Caption für den Post inkl. 3-5 Hashtags (deutsch).`;

    const response = await openai.responses.create({
        model: TEXT_MODEL,
        input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Thema: ${topic}` },
        ],
        text: {
            format: {
                type: 'json_schema',
                name: 'slide_plan',
                strict: true,
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['caption', 'slides'],
                    properties: {
                        caption: { type: 'string' },
                        slides: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                required: ['text', 'sceneDescription'],
                                properties: {
                                    text: { type: 'string' },
                                    sceneDescription: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    const plan = JSON.parse(response.output_text) as SlidePlan;
    if (plan.slides.length !== SLIDE_COUNT) {
        throw new Error(`Slide plan has ${plan.slides.length} slides instead of ${SLIDE_COUNT}`);
    }
    return plan;
}

const STYLE_BRIEF = `Organic TikTok photo slide, shot casually on a phone (natural light,
slightly imperfect framing, no studio look). Portrait format. The person in the scene
must look exactly like the reference photo. Overlay the German text in bold white
TikTok-style sans-serif with a subtle black outline, large and easy to read.`;

function buildSlidePrompt(slide: Slide, index: number): string {
    const consistency =
        index === 0
            ? 'Use the attached photo as identity reference for the person.'
            : "Keep the person's face, the typography and the overall look consistent with the previous slide.";

    const isLast = index === SLIDE_COUNT - 1;
    const storeEntryInstruction = isLast
        ? `

The attached image is the real App Store listing of the JEMP app. Place it directly
below the text as a clean rounded card, centered, taking roughly the lower third of
the slide. Reproduce it exactly as provided — do not change its logo, texts, rating
or layout.`
        : '';

    return `Generate slide ${index + 1} of ${SLIDE_COUNT} for a TikTok slide post.
${consistency}

Scene: ${slide.sceneDescription}

Render exactly this German text as overlay on the image:
"${slide.text}"${storeEntryInstruction}`;
}

function extractImage(response: OpenAI.Responses.Response): Buffer {
    const results = response.output
        .filter((output) => output.type === 'image_generation_call')
        .map((output) => output.result)
        .filter((result): result is string => typeof result === 'string');

    if (!results.length) {
        throw new Error('OpenAI response contains no generated image');
    }
    return Buffer.from(results[0], 'base64');
}

export async function generateSlideImages(
    openai: OpenAI,
    plan: SlidePlan,
    avatarImageUrl: string,
    onSlide?: (slideNumber: number) => Promise<void>
): Promise<Buffer[]> {
    const storeEntryDataUrl = `data:image/png;base64,${fs
        .readFileSync(STORE_ENTRY_PATH)
        .toString('base64')}`;

    const images: Buffer[] = [];
    let previousResponseId: string | undefined;

    for (const [index, slide] of plan.slides.entries()) {
        logger.info(`Generating slide ${index + 1}/${SLIDE_COUNT}`);
        await onSlide?.(index + 1);
        const prompt = buildSlidePrompt(slide, index);
        const isLast = index === SLIDE_COUNT - 1;

        const response = await openai.responses.create({
            model: IMAGE_MODEL,
            previous_response_id: previousResponseId,
            input:
                previousResponseId && !isLast
                    ? prompt
                    : [
                          {
                              role: 'user',
                              content: [
                                  {
                                      type: 'input_text',
                                      text: index === 0 ? `${STYLE_BRIEF}\n\n${prompt}` : prompt,
                                  },
                                  {
                                      type: 'input_image',
                                      image_url: isLast ? storeEntryDataUrl : avatarImageUrl,
                                      detail: 'high',
                                  },
                              ],
                          },
                      ],
            tools: [
                {
                    type: 'image_generation',
                    size: '1024x1536',
                    quality: 'high',
                },
            ],
        });
        previousResponseId = response.id;
        images.push(extractImage(response));
    }

    return images;
}
