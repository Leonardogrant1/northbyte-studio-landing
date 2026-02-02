import { NextRequest, NextResponse } from "next/server";

const N8N_ENDPOINT = "https://n8n-video-merger-38873740272.europe-west3.run.app/videos/store";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const videoFile = formData.get("video");

        if (!videoFile) {
            return NextResponse.json(
                { error: "No video file provided" },
                { status: 400 }
            );
        }

        // Forward the video to n8n endpoint
        const n8nFormData = new FormData();
        n8nFormData.append("video", videoFile);

        const response = await fetch(N8N_ENDPOINT, {
            method: "POST",
            body: n8nFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("n8n upload failed:", errorText);
            return NextResponse.json(
                { error: "Failed to upload video to n8n" },
                { status: response.status }
            );
        }

        const data = await response.json();

        return NextResponse.json(data, { status: 200 });
    } catch (error) {
        console.error("Error in approve video API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
