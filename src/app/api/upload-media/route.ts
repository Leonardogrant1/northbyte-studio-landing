import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generatePresignedUploadUrl, getPublicUrl, R2_BUCKETS } from "@/lib/r2";

const ACCEPTED_TYPES = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "image/jpeg",
    "image/png",
    "image/webp",
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileName, fileType } = body;

        if (!fileName || typeof fileName !== "string") {
            return NextResponse.json({ error: "fileName is required" }, { status: 400 });
        }

        if (!fileType || typeof fileType !== "string") {
            return NextResponse.json({ error: "fileType is required" }, { status: 400 });
        }

        if (!ACCEPTED_TYPES.includes(fileType)) {
            return NextResponse.json(
                { error: `Unsupported file type: ${fileType}` },
                { status: 400 }
            );
        }

        const isVideo = fileType.startsWith("video/");
        const folder = isVideo ? "videos" : "images";
        const ext = fileName.split(".").pop() || (isVideo ? "mp4" : "jpg");
        const key = `${folder}/${randomUUID()}.${ext}`;

        const uploadUrl = await generatePresignedUploadUrl(R2_BUCKETS.n8n, key, 600);
        const fileUrl = getPublicUrl(R2_BUCKETS.n8n, key);

        return NextResponse.json({ uploadUrl, key, fileUrl }, { status: 200 });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json({ error: "Failed to generate presigned URL" }, { status: 500 });
    }
}
