import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type RequestBody = {
    appSlug: string;
    affiliateCode: string;
    sessionId: string;
    referer?: string;
    country?: string;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;

        const { appSlug, affiliateCode, sessionId, referer, country } = body;

        if (!appSlug || !affiliateCode || !sessionId) {
            return NextResponse.json(
                { error: "appSlug, affiliateCode and sessionId are required." },
                { status: 400 }
            );
        }

        const result = await convex.mutation(api.affiliate_lead.mutations.logView, {
            appSlug,
            affiliateCode,
            sessionId,
            referer,
            country,
        });

        if ("error" in result) {
            const status = result.error === "not_found" ? 404 : 400;
            return NextResponse.json({ error: result.message }, { status });
        }

        return NextResponse.json({ success: true, leadId: result.leadId }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error.";
        console.error("[lead/view] unexpected error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
