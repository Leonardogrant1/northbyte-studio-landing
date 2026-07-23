import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type RequestBody = {
    appSlug: string;
    sessionId: string;
    platform?: string;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;

        const { appSlug, sessionId, platform } = body;

        if (!appSlug || !sessionId) {
            return NextResponse.json(
                { error: "appSlug and sessionId are required." },
                { status: 400 }
            );
        }

        const result = await convex.mutation(api.affiliate_lead.mutations.markStoreClick, {
            appSlug,
            sessionId,
            platform,
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.message }, { status: 404 });
        }

        return NextResponse.json({ success: true, updated: result.updated }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error.";
        console.error("[lead/store-click] unexpected error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
