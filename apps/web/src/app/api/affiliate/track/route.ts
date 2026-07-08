import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type RequestBody = {
    appSlug: string;
    affiliateCode: string;
    appUserId?: string;
    revenueCatUserId?: string;
    environment: "PRODUCTION" | "SANDBOX";
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;

        const { appSlug, affiliateCode, appUserId, revenueCatUserId, environment } = body;

        if (!appSlug || !affiliateCode) {
            return NextResponse.json(
                { error: "appSlug and affiliateCode are required." },
                { status: 400 }
            );
        }

        if (!appUserId && !revenueCatUserId) {
            return NextResponse.json(
                { error: "At least one of appUserId or revenueCatUserId is required." },
                { status: 400 }
            );
        }

        if (environment !== "PRODUCTION" && environment !== "SANDBOX") {
            return NextResponse.json(
                { error: "environment must be PRODUCTION or SANDBOX." },
                { status: 400 }
            );
        }

        const result = await convex.mutation(api.affiliate_referral.mutations.track, {
            appSlug,
            affiliateCode,
            appUserId,
            revenueCatUserId,
            environment,
        });

        if ("error" in result) {
            const status = result.error === "not_found" ? 404 : 400;
            return NextResponse.json({ error: result.message }, { status });
        }

        return NextResponse.json({ success: true, referralId: result.referralId }, { status: 201 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error.";
        console.error("[track] unexpected error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
