import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const VALID_EVENTS = ["INITIAL_PURCHASE", "CANCELLATION", "UNCANCELLATION", "REFUND"] as const;
type Event = (typeof VALID_EVENTS)[number];

type RequestBody = {
    appSlug: string;
    revenueCatUserId: string;
    event: Event;
    productId?: string;
    subscriptionId?: string;
    price?: number;
    currency?: string;
    priceUsd?: number;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;
        const { appSlug, revenueCatUserId, event, productId, subscriptionId, price, currency, priceUsd } = body;

        if (!appSlug || !revenueCatUserId || !event) {
            return NextResponse.json(
                { error: "appSlug, revenueCatUserId and event are required." },
                { status: 400 }
            );
        }

        if (!VALID_EVENTS.includes(event)) {
            return NextResponse.json(
                { error: `event must be one of: ${VALID_EVENTS.join(", ")}.` },
                { status: 400 }
            );
        }

        await convex.mutation(api.affiliate_referral.mutations.handleUpdate, {
            appSlug,
            revenueCatUserId,
            event,
            productId,
            subscriptionId,
            price,
            currency,
            priceUsd,
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error.";
        const status = message.includes("not found") ? 404 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
