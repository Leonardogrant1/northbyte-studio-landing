import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

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

        const vendorId = await convex.mutation(api.vendors.mutations.create, { name });

        return NextResponse.json(
            { success: true, vendorId, message: "Vendor created successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error creating vendor:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
