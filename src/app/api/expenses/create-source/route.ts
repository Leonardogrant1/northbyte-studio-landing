import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const sourceId = await convex.mutation(api.sources.mutations.create, { name });

        return NextResponse.json(
            { success: true, sourceId, message: "Source created successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error creating source:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
