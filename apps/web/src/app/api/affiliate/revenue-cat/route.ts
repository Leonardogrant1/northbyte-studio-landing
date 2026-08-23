import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const HANDLED_EVENTS = [
  "INITIAL_PURCHASE",
  "RESUBSCRIBE",
  "RENEWAL",
  "CANCELLATION",
  "UNCANCELLATION",
  "REFUND",
  "EXPIRATION",
] as const;
type HandledEvent = (typeof HANDLED_EVENTS)[number];

type RCStore = "APP_STORE" | "PLAY_STORE" | "AMAZON" | "STRIPE" | "MAC_APP_STORE" | "PROMOTIONAL";
type RCEnvironment = "PRODUCTION" | "SANDBOX";

type RevenueCatEvent = {
  type: string;
  app_id: string;
  app_user_id: string;
  period_type?: string;
  is_trial_conversion?: boolean;
  product_id?: string;
  transaction_id?: string;
  price?: number;
  price_in_purchased_currency?: number;
  currency?: string;
  country_code?: string;
  store?: RCStore;
  takehome_percentage?: number;
  environment?: RCEnvironment;
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
  const authHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
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
      periodType: event.period_type,
      isTrialConversion: event.is_trial_conversion,
      productId: event.product_id,
      transactionId: event.transaction_id,
      price: event.price,
      priceInPurchasedCurrency: event.price_in_purchased_currency,
      currency: event.currency,
      countryCode: event.country_code,
      store: event.store,
      takehomePercentage: event.takehome_percentage,
      environment: event.environment,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("[revenue-cat webhook]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
