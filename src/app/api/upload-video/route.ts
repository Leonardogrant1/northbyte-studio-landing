import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith("video/")) {
            return NextResponse.json(
                { error: "File must be a video" },
                { status: 400 }
            );
        }

        // Upload to Cloudflare R2 via Vercel Blob (which supports R2)
        const blob = await put(file.name, file, {
            access: "public",
            addRandomSuffix: true,
        });

        return NextResponse.json(
            {
                success: true,
                url: blob.url,
                downloadUrl: blob.downloadUrl,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error uploading to R2:", error);
        return NextResponse.json(
            { error: "Failed to upload video" },
            { status: 500 }
        );
    }
}
