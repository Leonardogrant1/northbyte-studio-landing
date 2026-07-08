import { mutation } from "../_generated/server";
import { v } from "convex/values";

const eventType = v.union(
  v.literal("INITIAL_PURCHASE"),
  v.literal("RESUBSCRIBE"),
  v.literal("RENEWAL"),
  v.literal("CANCELLATION"),
  v.literal("UNCANCELLATION"),
  v.literal("REFUND"),
);

// Public — called from external app backends via POST /api/affiliate/track.
// Looks up the app by slug and the affiliate profile by code, then records the referral.
export const track = mutation({
  args: {
    appSlug: v.string(),
    affiliateCode: v.string(),
    appUserId: v.optional(v.string()),
    revenueCatUserId: v.optional(v.string()),
    environment: v.union(v.literal("PRODUCTION"), v.literal("SANDBOX")),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .filter((q) => q.eq(q.field("slug"), args.appSlug))
      .first();
    if (!app) return { error: "not_found", message: `App with slug "${args.appSlug}" not found.` } as const;

    const profile = await ctx.db
      .query("affiliate_profiles")
      .filter((q) => q.eq(q.field("affiliateCode"), args.affiliateCode))
      .first();
    if (!profile) return { error: "not_found", message: `Affiliate code "${args.affiliateCode}" not found.` } as const;
    if (!profile.isActive) return { error: "inactive", message: `Affiliate code "${args.affiliateCode}" is inactive.` } as const;

    const referralId = await ctx.db.insert("affiliate_referral", {
      affiliateId: profile._id,
      appId: app._id,
      appUserId: args.appUserId,
      revenueCatUserId: args.revenueCatUserId,
      status: "pending",
      environment: args.environment,
      createdAt: Date.now(),
    });

    return { referralId };
  },
});

// Public — called from external app backends via POST /api/affiliate/referral/update.
// Finds the referral by revenueCatUserId + appSlug and updates status/payment data.
// Idempotent: repeated calls for the same event are no-ops.
export const handleUpdate = mutation({
  args: {
    appSlug: v.string(),
    revenueCatUserId: v.string(),
    event: eventType,
    productId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    priceUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .filter((q) => q.eq(q.field("slug"), args.appSlug))
      .first();
    if (!app) throw new Error(`App with slug "${args.appSlug}" not found.`);

    const referral = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_rc_user", (q) => q.eq("revenueCatUserId", args.revenueCatUserId))
      .filter((q) => q.eq(q.field("appId"), app._id))
      .first();

    // Unknown referral — not tracked via affiliate link, ignore silently
    if (!referral) return null;

    const now = Date.now();

    if (args.event === "INITIAL_PURCHASE" || args.event === "RESUBSCRIBE") {
      if (referral.convertedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        convertedAt: now,
        productId: args.productId,
        subscriptionId: args.subscriptionId,
        price: args.price,
        currency: args.currency,
        priceUsd: args.priceUsd,
      });
    } else if (args.event === "CANCELLATION") {
      if (referral.cancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "cancelled", cancelledAt: now });
    } else if (args.event === "UNCANCELLATION") {
      if (referral.uncancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "converted", uncancelledAt: now });
    } else if (args.event === "REFUND") {
      if (referral.refundedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "refunded",
        hasConverted: false, // payment reversed — affiliate not owed commission
        refundedAt: now,
      });
    }

    return referral._id;
  },
});

// Called from /api/affiliate/revenue-cat (RevenueCat webhook).
// Resolves app by RC app_id (App Store or Play Store), finds the affiliate referral
// by revenueCatUserId, and updates status. Idempotent.
//
// Commission is earned only on the first real payment:
//   - INITIAL_PURCHASE + periodType "NORMAL"  → direct purchase
//   - RESUBSCRIBE                              → user re-subscribed after cancellation/expiry
//   - RENEWAL + isTrialConversion true         → trial converted to paid (first real charge)
// RENEWAL without isTrialConversion is ignored (no commission on subsequent renewals).
export const handleRevenueCatEvent = mutation({
  args: {
    rcAppId: v.string(),
    appUserId: v.string(),
    event: eventType,
    periodType: v.optional(v.string()),         // "NORMAL" | "TRIAL" | "INTRO"
    isTrialConversion: v.optional(v.boolean()),
    productId: v.optional(v.string()),
    transactionId: v.optional(v.string()),
    price: v.optional(v.number()),              // always USD
    priceInPurchasedCurrency: v.optional(v.number()),
    currency: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    store: v.optional(v.union(
      v.literal("APP_STORE"),
      v.literal("PLAY_STORE"),
      v.literal("AMAZON"),
      v.literal("STRIPE"),
      v.literal("MAC_APP_STORE"),
      v.literal("PROMOTIONAL"),
    )),
    takehomePercentage: v.optional(v.number()), // developer's share after store cut (e.g. 0.85)
    environment: v.optional(v.union(
      v.literal("PRODUCTION"),
      v.literal("SANDBOX"),
    )),
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

    const resolvedApp = app;

    // 2. Referral lookup — only process if this user came via affiliate link
    const referral = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_rc_user", (q) => q.eq("revenueCatUserId", args.appUserId))
      .filter((q) => q.eq(q.field("appId"), resolvedApp._id))
      .first();

    if (!referral) return null;

    const now = Date.now();

    if (args.event === "INITIAL_PURCHASE" || args.event === "RESUBSCRIBE") {
      // Trial starts have price=0 — skip, wait for RENEWAL with isTrialConversion=true
      if (args.event === "INITIAL_PURCHASE" && args.periodType === "TRIAL") return null;
      if (referral.convertedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        hasConverted: true,
        convertedAt: now,
        productId: args.productId,
        subscriptionId: args.transactionId, // RC transaction_id stored as subscriptionId per schema field name
        price: args.price,
        priceInPurchasedCurrency: args.priceInPurchasedCurrency,
        currency: args.currency,
        countryCode: args.countryCode,
        store: args.store,
        takehomePercentage: args.takehomePercentage,
        environment: args.environment,
      });
    } else if (args.event === "RENEWAL") {
      // Only handle the first real payment after a trial — ignore all other renewals
      if (!args.isTrialConversion) return null;
      if (referral.convertedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        hasConverted: true,
        convertedAt: now,
        productId: args.productId,
        subscriptionId: args.transactionId, // RC transaction_id stored as subscriptionId per schema field name
        price: args.price,
        priceInPurchasedCurrency: args.priceInPurchasedCurrency,
        currency: args.currency,
        countryCode: args.countryCode,
        store: args.store,
        takehomePercentage: args.takehomePercentage,
        environment: args.environment,
      });
    } else if (args.event === "CANCELLATION") {
      if (referral.cancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "cancelled", cancelledAt: now });
    } else if (args.event === "UNCANCELLATION") {
      if (referral.uncancelledAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        uncancelledAt: now,
        cancelledAt: undefined, // clear so a future CANCELLATION is not a no-op
      });
    } else if (args.event === "REFUND") {
      if (referral.refundedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "refunded",
        hasConverted: false, // payment reversed — affiliate not owed commission
        refundedAt: now,
      });
    }

    return referral._id;
  },
});
