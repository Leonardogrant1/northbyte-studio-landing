import { NextRequest, NextResponse } from "next/server";
import { nanobana } from "@/lib/nanobana";
import type { AspectRatio, ImageSize } from "@/lib/nanobana";

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch avatar image: ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString("base64");
    return { data, mimeType: contentType.split(";")[0] };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, referenceImages, avatarImageUrl, aspectRatio, imageSize } = body;

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
        }

        const avatarImage = avatarImageUrl
            ? await fetchAsBase64(avatarImageUrl)
            : undefined;

        const result = await nanobana.generateImage({
            prompt: prompt.trim(),
            referenceImages: referenceImages ?? [],
            avatarImage,
            aspectRatio: aspectRatio as AspectRatio,
            imageSize: imageSize as ImageSize,
        });

        return NextResponse.json(result);
    } catch (err) {
        console.error("[generate-image]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Image generation failed." },
            { status: 500 }
        );
    }
}
