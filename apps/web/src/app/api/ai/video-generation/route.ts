import { NextRequest, NextResponse } from "next/server";
import { createText2VideoTask, createImage2VideoTask } from "@/lib/kling";
import type { KlingModelName, KlingMode, KlingVgDuration, KlingVgAspectRatio, KlingVgSound } from "@/lib/kling";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, model_name, prompt, negative_prompt, duration, mode, sound, aspect_ratio, image, image_tail } = body;

        if (type === "image") {
            if (!image && !image_tail) {
                return NextResponse.json({ error: "At least one of image or image_tail is required." }, { status: 400 });
            }
            const result = await createImage2VideoTask({
                model_name: model_name as KlingModelName,
                prompt: prompt?.trim(),
                negative_prompt: negative_prompt?.trim(),
                image: image || undefined,
                image_tail: image_tail || undefined,
                duration: duration as KlingVgDuration,
                mode: mode as KlingMode,
                sound: sound as KlingVgSound,
            });
            return NextResponse.json({ ...result, type: "image" });
        }

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "prompt is required." }, { status: 400 });
        }
        const result = await createText2VideoTask({
            model_name: model_name as KlingModelName,
            prompt: prompt.trim(),
            negative_prompt: negative_prompt?.trim(),
            duration: duration as KlingVgDuration,
            mode: mode as KlingMode,
            sound: sound as KlingVgSound,
            aspect_ratio: aspect_ratio as KlingVgAspectRatio,
        });
        return NextResponse.json({ ...result, type: "text" });
    } catch (err) {
        console.error("[video-generation]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Video generation task creation failed." },
            { status: 500 }
        );
    }
}
