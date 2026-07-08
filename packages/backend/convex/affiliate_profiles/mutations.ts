import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — update commission settings and affiliate code for a profile.
export const update = mutation({
  args: {
    profileId: v.id("affiliate_profiles"),
    affiliateCode: v.string(),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
    commissionAmount: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Affiliate profile not found.");

    // Check if code is taken by another profile
    if (args.affiliateCode !== profile.affiliateCode) {
      const taken = await ctx.db
        .query("affiliate_profiles")
        .collect()
        .then((all) =>
          all.some((p) => p.affiliateCode === args.affiliateCode && p._id !== args.profileId)
        );
      if (taken) throw new Error(`Der Affiliate-Code "${args.affiliateCode}" ist bereits vergeben.`);
    }

    await ctx.db.patch(args.profileId, {
      affiliateCode: args.affiliateCode,
      commissionType: args.commissionType,
      commissionAmount: args.commissionAmount,
      isActive: args.isActive,
    });
  },
});
