import { query } from "../_generated/server";
import { v } from "convex/values";

// Returns computed stats for the currently authenticated affiliate,
// filtered by an optional date range (fromMs / toMs = epoch ms on createdAt).
export const getMyStats = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    environment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const profile = await ctx.db
      .query("affiliate_profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) return null;

    const allReferrals = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
      .collect();

    // Filter by date range and sandbox/production
    const referrals = allReferrals.filter((r) => {
      if (args.fromMs !== undefined && r.createdAt < args.fromMs) return false;
      if (args.toMs !== undefined && r.createdAt > args.toMs) return false;
      if (args.environment !== undefined && r.environment !== args.environment) return false;
      return true;
    });

    const converted = referrals.filter((r) => r.convertedAt !== undefined);
    const cancelled = referrals.filter((r) => r.cancelledAt !== undefined);
    const refunded = referrals.filter((r) => r.refundedAt !== undefined);
    // hasConverted=true: first payment received and not refunded — affiliate is owed commission
    const earned_referrals = referrals.filter((r) => r.hasConverted === true);

    // Earnings: commission on developer takehome (after store cut), only for non-refunded conversions.
    // takehome = price * takehomePercentage (e.g. 58.93 * 0.85 = 50.09 USD)
    const earned = earned_referrals.reduce((sum, r) => {
      if (!r.price) return sum;
      const takehome = r.price * (r.takehomePercentage ?? 1);
      if (profile.commissionType === "percentage") {
        return sum + (takehome * profile.commissionAmount) / 100;
      }
      return sum + profile.commissionAmount;
    }, 0);

    const referredCount = referrals.length;
    const convertedCount = converted.length;

    return {
      earned,
      referredUsers: referredCount,
      convertedUsers: convertedCount,
      conversionRate: referredCount > 0 ? (convertedCount / referredCount) * 100 : 0,
      cancelRate: convertedCount > 0 ? (cancelled.length / convertedCount) * 100 : 0,
      refundRate: convertedCount > 0 ? (refunded.length / convertedCount) * 100 : 0,
    };
  },
});

// Returns the affiliate profile for the currently authenticated user.
export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    return await ctx.db
      .query("affiliate_profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
  },
});

// Admin-only — returns the affiliate profile for a given userId.
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") return null;

    return await ctx.db
      .query("affiliate_profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
