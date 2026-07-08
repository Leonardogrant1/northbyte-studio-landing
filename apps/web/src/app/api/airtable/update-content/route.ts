import { NextRequest, NextResponse } from "next/server";
import { updateContent } from "@/lib/airtable";

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, mediaUrl, status } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Content ID is required" },
                { status: 400 }
            );
        }

        const success = await updateContent(id, {
            mediaUrl,
            status,
        });

        if (success) {
            return NextResponse.json(
                { success: true, message: "Content updated successfully" },
                { status: 200 }
            );
        } else {
            return NextResponse.json(
                { error: "Failed to update content" },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Error in update content API:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
