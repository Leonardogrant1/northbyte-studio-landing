import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, getPublicUrl } from "@/lib/r2";
import { R2_BUCKETS } from "@/lib/r2-constants";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { key } = body;

        // Validate input
        if (!key || typeof key !== "string") {
            return NextResponse.json(
                { error: "key is required and must be a string" },
                { status: 400 }
            );
        }

        // Verify the file exists in R2
        try {
            await r2Client.send(
                new HeadObjectCommand({
                    Bucket: R2_BUCKETS.n8n,
                    Key: key,
                })
            );
        } catch (error) {
            console.error("File not found in R2:", error);
            return NextResponse.json(
                { error: "File not found in R2 storage" },
                { status: 404 }
            );
        }

        // Get the public download URL
        const downloadUrl = getPublicUrl(R2_BUCKETS.n8n, key);

        return NextResponse.json(
            {
                success: true,
                downloadUrl,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error confirming upload:", error);
        return NextResponse.json(
            { error: "Failed to confirm upload" },
            { status: 500 }
        );
    }
}
