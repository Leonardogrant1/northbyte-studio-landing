import { NextResponse } from "next/server";
import { fetchContents } from "@/lib/airtable";

export async function GET() {
    try {
        const contents = await fetchContents();

        return NextResponse.json(
            { success: true, contents },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching contents:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch contents from Airtable",
                message: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}
