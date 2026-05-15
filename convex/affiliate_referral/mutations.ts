import { mutation } from "../_generated/server";
import { v } from "convex/values";

const eventType = v.union(
  v.literal("INITIAL_PURCHASE"),
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
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .filter((q) => q.eq(q.field("slug"), args.appSlug))
      .first();
    if (!app) throw new Error(`App with slug "${args.appSlug}" not found.`);

    const profile = await ctx.db
      .query("affiliate_profiles")
      .filter((q) => q.eq(q.field("affiliateCode"), args.affiliateCode))
      .first();
    if (!profile) throw new Error(`Affiliate code "${args.affiliateCode}" not found.`);
    if (!profile.isActive) throw new Error(`Affiliate code "${args.affiliateCode}" is inactive.`);

    return await ctx.db.insert("affiliate_referral", {
      affiliateId: profile._id,
      appId: app._id,
      appUserId: args.appUserId,
      revenueCatUserId: args.revenueCatUserId,
      status: "pending",
      createdAt: Date.now(),
    });
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

    if (args.event === "INITIAL_PURCHASE") {
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
      await ctx.db.patch(referral._id, { status: "refunded", refundedAt: now });
    }

    return referral._id;
  },
});

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

    const resolvedApp = app;

    // 2. Referral lookup — only process if this user came via affiliate link
    const referral = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_rc_user", (q) => q.eq("revenueCatUserId", args.appUserId))
      .filter((q) => q.eq(q.field("appId"), resolvedApp._id))
      .first();

    if (!referral) return null;

    const now = Date.now();

    if (args.event === "INITIAL_PURCHASE") {
      if (referral.convertedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, {
        status: "converted",
        convertedAt: now,
        productId: args.productId,
        subscriptionId: args.transactionId, // RC transaction_id stored as subscriptionId per schema field name
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
      await ctx.db.patch(referral._id, {
        status: "converted",
        uncancelledAt: now,
        cancelledAt: undefined, // clear so a future CANCELLATION is not a no-op
      });
    } else if (args.event === "REFUND") {
      if (referral.refundedAt !== undefined) return null; // idempotent
      await ctx.db.patch(referral._id, { status: "refunded", refundedAt: now });
    }

    return referral._id;
  },
});
