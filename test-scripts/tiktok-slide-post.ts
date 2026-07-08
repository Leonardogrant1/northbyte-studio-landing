import fs from "node:fs";
import path from "node:path";
import { OpenAI } from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// dotenv ist nicht installiert — Node 22 kann env-Dateien nativ laden
for (const file of [".env", ".env.local"]) {
    try {
        process.loadEnvFile(path.join(process.cwd(), file));
    } catch {
        // Datei existiert nicht — ok
    }
}

const TEXT_MODEL = "gpt-5.5";
const IMAGE_MODEL = "gpt-5.5";
const AVATAR_NAME = "john";
const SLIDE_COUNT = 4;
const STORE_ENTRY_PATH = path.join("test-scripts", "store_entry.png");

const APP_CONTEXT = `Die App "jemp" erstellt athletische Trainingspläne für Athleten,
die ihre Athletik verbessern wollen: Sprungkraft, Explosivität, Kraft und Mobilität.`;

interface Slide {
    text: string;
    sceneDescription: string;
}

interface SlidePlan {
    caption: string;
    slides: Slide[];
}

interface Avatar {
    name: string;
    imageUrl: string;
    description: string;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not defined`);
    return value;
}

async function fetchAvatar(convexUrl: string): Promise<Avatar> {
    const convex = new ConvexHttpClient(convexUrl);
    const records = (await convex.query(api.generic.queries.findByFilters, {
        table: "ai_avatars",
        conditions: [{ field: "name", contains: AVATAR_NAME }],
    })) as Avatar[];

    if (!records.length) {
        throw new Error(`Kein ai_avatar mit Namen "${AVATAR_NAME}" gefunden`);
    }
    return records[0];
}

async function planSlides(openai: OpenAI, topic: string, avatar: Avatar): Promise<SlidePlan> {
    const systemPrompt = `Du bist Content-Stratege für organische TikTok-Slide-Posts.

${APP_CONTEXT}

Die Slides zeigen den Creator "John": ${avatar.description}.
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
- "sceneDescription": Die Bildszene mit John (englisch, für die Bildgenerierung) —
  was John tut, Ort, Stimmung. Passend zum Slide-Text, athletischer Kontext.

Zusätzlich "caption": Die TikTok-Caption für den Post inkl. 3-5 Hashtags (deutsch).`;

    const response = await openai.responses.create({
        model: TEXT_MODEL,
        input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Thema: ${topic}` },
        ],
        text: {
            format: {
                type: "json_schema",
                name: "slide_plan",
                strict: true,
                schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["caption", "slides"],
                    properties: {
                        caption: { type: "string" },
                        slides: {
                            type: "array",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                required: ["text", "sceneDescription"],
                                properties: {
                                    text: { type: "string" },
                                    sceneDescription: { type: "string" },
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
        throw new Error(`Plan hat ${plan.slides.length} Slides statt ${SLIDE_COUNT}`);
    }
    return plan;
}

const STYLE_BRIEF = `Organic TikTok photo slide, shot casually on a phone (natural light,
slightly imperfect framing, no studio look). Portrait format. The person in the scene is John —
he must look exactly like the reference photo. Overlay the German text in bold white
TikTok-style sans-serif with a subtle black outline, large and easy to read.`;

function buildSlidePrompt(slide: Slide, index: number): string {
    const consistency =
        index === 0
            ? "Use the attached photo of John as identity reference."
            : "Keep John's face, the typography and the overall look consistent with the previous slide.";

    const isLast = index === SLIDE_COUNT - 1;
    const storeEntryInstruction = isLast
        ? `

The attached image is the real App Store listing of the JEMP app. Place it directly
below the text as a clean rounded card, centered, taking roughly the lower third of
the slide. Reproduce it exactly as provided — do not change its logo, texts, rating
or layout.`
        : "";

    return `Generate slide ${index + 1} of ${SLIDE_COUNT} for a TikTok slide post.
${consistency}

Scene: ${slide.sceneDescription}

Render exactly this German text as overlay on the image:
"${slide.text}"${storeEntryInstruction}`;
}

function extractImage(response: OpenAI.Responses.Response): Buffer {
    const results = response.output
        .filter((output) => output.type === "image_generation_call")
        .map((output) => output.result)
        .filter((result): result is string => typeof result === "string");

    if (!results.length) {
        throw new Error("Response enthält kein generiertes Bild");
    }
    return Buffer.from(results[0], "base64");
}

async function generateSlideImages(
    openai: OpenAI,
    plan: SlidePlan,
    avatar: Avatar,
    outDir: string
): Promise<string[]> {
    const files: string[] = [];
    let previousResponseId: string | undefined;

    const storeEntryDataUrl = `data:image/png;base64,${fs
        .readFileSync(STORE_ENTRY_PATH)
        .toString("base64")}`;

    for (const [index, slide] of plan.slides.entries()) {
        console.log(`🎨 Generiere Slide ${index + 1}/${SLIDE_COUNT}...`);
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
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: index === 0 ? `${STYLE_BRIEF}\n\n${prompt}` : prompt,
                                },
                                {
                                    type: "input_image",
                                    image_url: isLast ? storeEntryDataUrl : avatar.imageUrl,
                                    detail: "high",
                                },
                            ],
                        },
                    ],
            tools: [
                {
                    type: "image_generation",
                    size: "1024x1536",
                    quality: "high",
                },
            ],
        });
        previousResponseId = response.id;

        const file = path.join(outDir, `slide-${index + 1}.png`);
        fs.writeFileSync(file, extractImage(response));
        files.push(file);
        console.log(`   ✅ ${file}`);
    }

    return files;
}

async function main() {
    const topic = process.argv.slice(2).join(" ").trim();
    if (!topic) {
        console.error('Usage: npx tsx test-scripts/tiktok-slide-post.ts "<Thema>"');
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
    const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL");

    if (!fs.existsSync(STORE_ENTRY_PATH)) {
        throw new Error(`Store-Entry-Bild fehlt: ${STORE_ENTRY_PATH}`);
    }

    console.log(`👤 Lade Avatar "${AVATAR_NAME}"...`);
    const avatar = await fetchAvatar(convexUrl);
    console.log(`   ✅ ${avatar.name} (${avatar.description})`);

    console.log(`📝 Plane Slides zum Thema "${topic}"...`);
    const plan = await planSlides(openai, topic, avatar);
    plan.slides.forEach((slide, i) => console.log(`   Slide ${i + 1}: ${slide.text}`));

    const outDir = path.join("test-scripts", "output", String(Date.now()));
    fs.mkdirSync(outDir, { recursive: true });

    const files = await generateSlideImages(openai, plan, avatar, outDir);

    const postJson = path.join(outDir, "post.json");
    fs.writeFileSync(
        postJson,
        JSON.stringify(
            {
                topic,
                caption: plan.caption,
                avatar: { name: avatar.name, imageUrl: avatar.imageUrl },
                models: { text: TEXT_MODEL, image: IMAGE_MODEL },
                slides: plan.slides.map((slide, i) => ({ ...slide, file: files[i] })),
            },
            null,
            2
        )
    );

    console.log(`\n🚀 Fertig! Output in ${outDir}`);
    console.log(`   Caption: ${plan.caption}`);
}

main().catch((error) => {
    console.error("❌", error);
    process.exit(1);
});
