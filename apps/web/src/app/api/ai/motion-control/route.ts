import { NextRequest, NextResponse } from "next/server";
import { createMotionControlTask } from "@/lib/kling";
import type { CharacterOrientation, KeepOriginalSound, KlingModelName, KlingMode } from "@/lib/kling";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, image_url, video_url, model_name, mode, keep_original_sound, character_orientation } = body;

        if (!image_url?.trim()) {
            return NextResponse.json({ error: "image_url is required." }, { status: 400 });
        }
        if (!video_url?.trim()) {
            return NextResponse.json({ error: "video_url is required." }, { status: 400 });
        }

        const result = await createMotionControlTask({
            prompt: prompt?.trim(),
            image_url: image_url.trim(),
            video_url: video_url.trim(),
            model_name: model_name as KlingModelName,
            mode: mode as KlingMode,
            keep_original_sound: keep_original_sound as KeepOriginalSound,
            character_orientation: character_orientation as CharacterOrientation,
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error("[motion-control]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Motion control task creation failed." },
            { status: 500 }
        );
    }
}
