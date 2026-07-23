import { query } from "../_generated/server";
import { v } from "convex/values";
import { computeStats } from "./stats";

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

    const allLeads = await ctx.db
      .query("affiliate_lead")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
      .collect();

    // Business-Zahlen (Umsatz/Proceeds/Netto) sind nur für Admins — hier bewusst nicht ausliefern.
    const { revenue: _revenue, proceeds: _proceeds, net: _net, ...affiliateVisible } =
      computeStats(profile, allReferrals, allLeads, args);
    return affiliateVisible;
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

// Admin-only — all affiliate profiles (linked + standalone) with computed stats.
export const getAllWithStats = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    environment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") return null;

    const profiles = await ctx.db.query("affiliate_profiles").collect();

    return await Promise.all(
      profiles.map(async (profile) => {
        const user = profile.userId ? await ctx.db.get(profile.userId) : null;
        const referrals = await ctx.db
          .query("affiliate_referral")
          .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
          .collect();

        const leads = await ctx.db
          .query("affiliate_lead")
          .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
          .collect();

        const displayName = user
          ? [user.name, user.lastName].filter(Boolean).join(" ") || user.email || "—"
          : profile.name ?? "—";

        return {
          profileId: profile._id,
          name: displayName,
          email: user?.email ?? null,
          affiliateCode: profile.affiliateCode,
          commissionType: profile.commissionType,
          commissionAmount: profile.commissionAmount,
          isActive: profile.isActive,
          isStandalone: profile.userId === undefined,
          stats: computeStats(profile, referrals, leads, args),
        };
      }),
    );
  },
});
