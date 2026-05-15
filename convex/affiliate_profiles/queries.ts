import { query } from "../_generated/server";
import { v } from "convex/values";

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
