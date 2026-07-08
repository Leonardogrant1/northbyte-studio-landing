import { NextRequest, NextResponse } from "next/server";
import { generateImageWithGeminiVertex } from "@/lib/gemini";
import type { GeminiAspectRatio } from "@/lib/gemini";

async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch avatar image: ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    return {
        base64: Buffer.from(buffer).toString("base64"),
        mimeType: contentType.split(";")[0],
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, referenceImages, avatarImageUrl, aspectRatio } = body;

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        const allReferenceImages: Array<{ base64: string; mimeType: string }> = [];

        if (avatarImageUrl) {
            const avatar = await fetchAsBase64(avatarImageUrl);
            allReferenceImages.push(avatar);
        }

        for (const img of referenceImages ?? []) {
            allReferenceImages.push({ base64: img.data, mimeType: img.mimeType });
        }

        const imageData = await generateImageWithGeminiVertex(
            prompt.trim(),
            "",
            allReferenceImages,
            (aspectRatio as GeminiAspectRatio) ?? "9:16",
        );

        return NextResponse.json({
            data: imageData,
            mimeType: "image/png",
            dataUrl: `data:image/png;base64,${imageData}`,
        });
    } catch (err) {
        console.error("[generate-image]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Image generation failed." },
            { status: 500 }
        );
    }
}
