import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAuthenticatedUserId } from "@/lib/auth";

const SYSTEM_PROMPT = `You are a social media copywriter. Based on the user's topic description, generate content for a social media post:
- "title": a short internal working title for the post (max 8 words, no hashtags, no emojis)
- "description": a hook-driven, engaging caption (2-4 short sentences or lines, emojis are welcome, no hashtags inside the caption)
- "hashtags": 8-12 relevant hashtags, each WITHOUT the leading "#", no spaces, mix of broad and niche tags

Always respond in the same language the user's topic is written in. Keep the content platform-neutral so it works on TikTok, Instagram and X alike.`;

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
        if (!topic) {
            return NextResponse.json({ error: "Topic is required." }, { status: 400 });
        }

        const openai = new OpenAI();
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: topic },
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "post_content",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            hashtags: { type: "array", items: { type: "string" } },
                        },
                        required: ["title", "description", "hashtags"],
                        additionalProperties: false,
                    },
                },
            },
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) throw new Error("Leere Antwort von OpenAI.");

        const parsed = JSON.parse(raw) as {
            title: string;
            description: string;
            hashtags: string[];
        };

        const hashtags = parsed.hashtags
            .map((t) => t.replace(/^#/, "").replace(/\s+/g, ""))
            .filter(Boolean);

        return NextResponse.json({
            title: parsed.title,
            description: parsed.description,
            hashtags,
        });
    } catch (err) {
        console.error("[generate-post-content]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Content generation failed." },
            { status: 500 }
        );
    }
}
