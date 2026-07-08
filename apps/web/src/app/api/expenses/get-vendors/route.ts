import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const revalidate = 0;

export async function GET() {
    try {
        const vendors = await convex.query(api.vendors.queries.getAll);

        return NextResponse.json(
            { success: true, vendors },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
