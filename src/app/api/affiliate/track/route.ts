import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type RequestBody = {
    appSlug: string;
    affiliateCode: string;
    appUserId?: string;
    revenueCatUserId?: string;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;

        const { appSlug, affiliateCode, appUserId, revenueCatUserId } = body;

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

        const referralId = await convex.mutation(api.affiliate_referral.mutations.track, {
            appSlug,
            affiliateCode,
            appUserId,
            revenueCatUserId,
        });

        return NextResponse.json({ success: true, referralId }, { status: 201 });
    } catch (err) {
        const isConvexErr =
            err instanceof ConvexError ||
            (err != null && (err as any)[Symbol.for("ConvexError")] === true);

        const message = isConvexErr
            ? String((err as ConvexError<{}>).data)
            : err instanceof Error
                ? err.message
                : "Internal server error.";

        console.error("[track] caught error:", {
            name: err?.constructor?.name,
            isConvexError: err instanceof ConvexError,
            symbolCheck: (err as any)?.[Symbol.for("ConvexError")],
            data: (err as any)?.data,
            message,
        });

        const status = message.includes("not found") || message.includes("inactive") ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
