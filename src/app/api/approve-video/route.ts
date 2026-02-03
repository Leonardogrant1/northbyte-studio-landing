import { NextRequest, NextResponse } from "next/server";
import { updateContent } from "@/lib/airtable";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, downloadUrl, contentId } = body;

        // Validate input
        if (!key || typeof key !== "string") {
            return NextResponse.json(
                { error: "key is required and must be a string" },
                { status: 400 }
            );
        }

        if (!downloadUrl || typeof downloadUrl !== "string") {
            return NextResponse.json(
                { error: "downloadUrl is required and must be a string" },
                { status: 400 }
            );
        }

        if (!contentId || typeof contentId !== "string") {
            return NextResponse.json(
                { error: "contentId is required and must be a string" },
                { status: 400 }
            );
        }

        // Verify upload with R2 confirm endpoint
        const confirmResponse = await fetch(`${request.nextUrl.origin}/api/r2/confirm-upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ key }),
        });

        if (!confirmResponse.ok) {
            const error = await confirmResponse.json();
            return NextResponse.json(
                { error: error.error || "Failed to verify upload" },
                { status: confirmResponse.status }
            );
        }

        // Update Airtable with the new media URL and status
        const success = await updateContent(contentId, {
            "Media": downloadUrl,
            "Status": "Ready For Scheduling",
        });

        if (!success) {
            return NextResponse.json(
                { error: "Failed to update Airtable" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                downloadUrl,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error in approve video API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
