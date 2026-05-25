import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileName, fileType, existingKey } = body;

        if (!fileName || typeof fileName !== "string") {
            return NextResponse.json(
                { error: "fileName is required and must be a string" },
                { status: 400 }
            );
        }

        if (!fileType || typeof fileType !== "string") {
            return NextResponse.json(
                { error: "fileType is required and must be a string" },
                { status: 400 }
            );
        }

        if (!fileType.startsWith("video/")) {
            return NextResponse.json(
                { error: "Only video files are allowed" },
                { status: 400 }
            );
        }

        let key: string;
        if (existingKey && typeof existingKey === "string" && /^videos\/[^/]+$/.test(existingKey)) {
            key = existingKey;
        } else {
            const fileExtension = fileName.split(".").pop() || "mp4";
            key = `videos/${randomUUID()}.${fileExtension}`;
        }

        const uploadUrl = await generatePresignedUploadUrl(key, 600);
        const downloadUrl = getPublicUrl(key);

        return NextResponse.json({ uploadUrl, key, downloadUrl }, { status: 200 });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
}
