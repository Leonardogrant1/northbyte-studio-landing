import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const HANDLED_EVENTS = [
  "INITIAL_PURCHASE",
  "CANCELLATION",
  "UNCANCELLATION",
  "REFUND",
] as const;
type HandledEvent = (typeof HANDLED_EVENTS)[number];

type RevenueCatEvent = {
  type: string;
  app_id: string;
  app_user_id: string;
  product_id?: string;
  transaction_id?: string;
  price?: number;
  currency?: string;
  country_code?: string;
  store?: string;
};

type RevenueCatWebhookBody = {
  api_version: string;
  event: RevenueCatEvent;
};

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.REVENUE_CAT_WEBHOOK_SECRET;
  if (!authHeader || !secret || !safeCompare(authHeader, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as RevenueCatWebhookBody;

    if (!body?.event?.type) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const { event } = body;

    if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
      // Always return 2xx — RC retries on non-2xx
      return NextResponse.json({ received: true }, { status: 200 });
    }

    await convex.mutation(api.affiliate_referral.mutations.handleRevenueCatEvent, {
      rcAppId: event.app_id,
      appUserId: event.app_user_id,
      event: event.type as HandledEvent,
      productId: event.product_id,
      transactionId: event.transaction_id,
      price: event.price,
      currency: event.currency,
      countryCode: event.country_code,
      store: event.store,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[revenue-cat webhook]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
