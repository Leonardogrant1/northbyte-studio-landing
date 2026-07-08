import { NextRequest, NextResponse } from "next/server";
import { fetchCreatorById, fetchAccountsByIds } from "@/lib/airtable";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ creatorId: string }> }
) {
    try {
        const paramsData = await params;
        const creatorId = paramsData.creatorId;

        if (!creatorId) {
            return NextResponse.json(
                { success: false, error: "Creator ID is required" },
                { status: 400 }
            );
        }

        // 1. Fetch Creator
        const creator = await fetchCreatorById(creatorId);

        console.log("Creator:", creator);

        if (!creator) {
            return NextResponse.json(
                { success: false, error: "Creator not found" },
                { status: 404 }
            );
        }

        // 2. Fetch linked Social Media Accounts (if any)
        const accounts = creator.Accounts && creator.Accounts.length > 0
            ? await fetchAccountsByIds(creator.Accounts)
            : [];

        return NextResponse.json(
            {
                success: true,
                creator,
                accounts,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching creator and accounts:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch creator data",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
