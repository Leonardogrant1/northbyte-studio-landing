# RevenueCat Webhook Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single RevenueCat webhook endpoint that receives purchase events for all apps, resolves the app via stored RC App IDs, and updates affiliate referrals — replacing the need for individual app backends to call `/api/affiliate/referral/update`.

**Architecture:** Three changes in sequence: schema additions (new fields + indexes on `apps` and `affiliate_referral`), a new Convex mutation `handleRevenueCatEvent` that maps RC event fields to our data model, and a new Next.js API route that validates the RC auth header and calls that mutation.

**Tech Stack:** Convex (schema + mutations), Next.js App Router (API route), TypeScript

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `convex/schema.ts` | Add RC app ID fields + indexes on `apps`; add `countryCode`/`store` on `affiliate_referral` |
| Modify | `convex/affiliate_referral/mutations.ts` | Add `handleRevenueCatEvent` mutation |
| Create | `src/app/api/affiliate/revenue-cat/route.ts` | Auth validation + RC event → mutation bridge |

---

### Task 1: Schema — add RC App IDs to `apps` and purchase context to `affiliate_referral`

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `revenueCatAppStoreId`, `revenueCatPlayStoreId` fields and their indexes to the `apps` table**

In `convex/schema.ts`, find the `apps` table definition (line 96). Replace the closing `),` of the `apps` table with:

```ts
    apps: defineTable({
        name: v.string(),
        domain: v.optional(v.string()),
        tagline: v.string(),
        logoStorageId: v.optional(v.id("_storage")),
        thumbnailStorageId: v.optional(v.id("_storage")),
        slug: v.string(),
        description: v.string(),
        status: v.string(),
        revenueCatProjectId: v.optional(v.string()),
        revenueCatApiKeyEncrypted: v.optional(v.string()),
        revenueCatAppStoreId: v.optional(v.string()),
        revenueCatPlayStoreId: v.optional(v.string()),
        postHogProjectId: v.optional(v.string()),
        postHogApiKeyEncrypted: v.optional(v.string()),
        postHogInstallEvent: v.optional(v.string()),
        postHogTrialEvent: v.optional(v.string()),
        termsOfUse: v.optional(v.string()),
        privacyPolicy: v.optional(v.string()),
    })
        .index("by_rc_appstore_id", ["revenueCatAppStoreId"])
        .index("by_rc_playstore_id", ["revenueCatPlayStoreId"]),
```

- [ ] **Step 2: Add `countryCode` and `store` fields to the `affiliate_referral` table**

In the same file, find the `affiliate_referral` table definition (line 27). Replace it with:

```ts
    affiliate_referral: defineTable({
        affiliateId: v.id("affiliate_profiles"),
        appId: v.id("apps"),
        appUserId: v.optional(v.string()),
        revenueCatUserId: v.optional(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("converted"),
            v.literal("cancelled"),
            v.literal("refunded"),
        ),
        productId: v.optional(v.string()),
        subscriptionId: v.optional(v.string()),
        price: v.optional(v.number()),
        currency: v.optional(v.string()),
        priceUsd: v.optional(v.number()),
        countryCode: v.optional(v.string()),
        store: v.optional(v.string()),
        convertedAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        uncancelledAt: v.optional(v.number()),
        refundedAt: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_affiliate", ["affiliateId"])
        .index("by_rc_user", ["revenueCatUserId"]),
```

- [ ] **Step 3: Verify schema compiles**

Run:
```bash
npx convex dev --once
```
Expected: no TypeScript errors, schema deployed successfully. If `convex dev` is already running in another terminal, saving the file is enough — watch for deploy success in its output.

---

### Task 2: Add `handleRevenueCatEvent` mutation

**Files:**
- Modify: `convex/affiliate_referral/mutations.ts`

- [ ] **Step 1: Append the new mutation to the end of the file**

Open `convex/affiliate_referral/mutations.ts` and append after the closing `};` of `handleUpdate`:

```ts
// Called from /api/affiliate/revenue-cat (RevenueCat webhook).
// Resolves app by RC app_id (App Store or Play Store), finds the affiliate referral
// by revenueCatUserId, and updates status. Idempotent.
export const handleRevenueCatEvent = mutation({
  args: {
    rcAppId: v.string(),
    appUserId: v.string(),
    event: eventType,
    productId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    store: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. App lookup — try App Store first, then Play Store
    let app = await ctx.db
      .query("apps")
      .withIndex("by_rc_appstore_id", (q) =>
        q.eq("revenueCatAppStoreId", args.rcAppId)
      )
      .first();

    if (!app) {
      app = await ctx.db
        .query("apps")
        .withIndex("by_rc_playstore_id", (q) =>
          q.eq("revenueCatPlayStoreId", args.rcAppId)
        )
        .first();
    }

    if (!app) {
      throw new Error(`No app found for RevenueCat app_id "${args.rcAppId}".`);
    }

    // 2. Referral lookup — only process if this user came via affiliate link
    const referral = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_rc_user", (q) => q.eq("revenueCatUserId", args.appUserId))
      .filter((q) => q.eq(q.field("appId"), app!._id))
      .first();

    if (!referral) return null;

    const now = Date.now();

    if (args.event === "INITIAL_PURCHASE") {
      if (referral.convertedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        convertedAt: now,
        productId: args.productId,
        subscriptionId: args.transactionId,
        price: args.price,
        currency: args.currency,
        countryCode: args.countryCode,
        store: args.store,
      });
    } else if (args.event === "CANCELLATION") {
      if (referral.cancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "cancelled", cancelledAt: now });
    } else if (args.event === "UNCANCELLATION") {
      if (referral.uncancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "converted", uncancelledAt: now });
    } else if (args.event === "REFUND") {
      if (referral.refundedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "refunded", refundedAt: now });
    }

    return referral._id;
  },
});
```

- [ ] **Step 2: Verify Convex picks up the new mutation**

If `convex dev` is running, watch for successful deploy in its output. Otherwise:
```bash
npx convex dev --once
```
Expected: no errors, `handleRevenueCatEvent` appears in `convex/_generated/api.d.ts` under `affiliate_referral.mutations`.

---

### Task 3: Create the webhook API route

**Files:**
- Create: `src/app/api/affiliate/revenue-cat/route.ts`

- [ ] **Step 1: Create the file**

```ts
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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== process.env.REVENUE_CAT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as RevenueCatWebhookBody;
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
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add the env variable to your `.env.local`**

```bash
REVENUE_CAT_WEBHOOK_SECRET=<the value from RevenueCat dashboard webhook Authorization header field>
```

Also add it to your production environment (Vercel / Fly.io / wherever this deploys).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test — auth rejection**

Start the dev server (`npm run dev`) and run:
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/affiliate/revenue-cat \
  -H "Content-Type: application/json" \
  -H "Authorization: wrong-secret" \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE","app_id":"test","app_user_id":"test"}}'
```
Expected output: `401`

- [ ] **Step 5: Manual smoke test — ignored event type**

```bash
curl -s -X POST http://localhost:3000/api/affiliate/revenue-cat \
  -H "Content-Type: application/json" \
  -H "Authorization: $REVENUE_CAT_WEBHOOK_SECRET" \
  -d '{"api_version":"1.0","event":{"type":"RENEWAL","app_id":"test","app_user_id":"test"}}'
```
Expected output: `{"received":true}` with status 200.

---

### Task 4: Configure RevenueCat dashboard

- [ ] **Step 1: Add RC App IDs to an app record in Convex**

In the Convex dashboard, open any `apps` document and set `revenueCatAppStoreId` to the value you see as `app_id` in your RC webhook events (e.g. `appe8898481f5`). Set `revenueCatPlayStoreId` if you have a Play Store variant.

- [ ] **Step 2: Point the RC webhook URL to this backend**

In the RevenueCat dashboard (Integrations → Webhooks), set the Webhook URL to:
```
https://<your-production-domain>/api/affiliate/revenue-cat
```
Set the Authorization header value to the same value as `REVENUE_CAT_WEBHOOK_SECRET`.

- [ ] **Step 3: Send a test event from RC dashboard**

Use the "Send test" button in the RevenueCat webhook UI. Confirm the event shows as `Sent` (not failed) in the webhook log.
