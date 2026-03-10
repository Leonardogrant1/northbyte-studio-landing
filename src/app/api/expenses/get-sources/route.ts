import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const revalidate = 0;

export async function GET() {
    try {
        const sources = await convex.query(api.sources.queries.getAll);

        return NextResponse.json(
            { success: true, sources },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching sources:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
