import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — assign an app to a support user (idempotent).
export const assign = mutation({
  args: {
    userId: v.id("users"),
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    // Idempotent: skip if already assigned
    const existing = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("appId"), args.appId))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("support_assignments", {
      userId: args.userId,
      appId: args.appId,
    });
  },
});

// Admin-only — remove an app assignment from a support user (idempotent).
export const unassign = mutation({
  args: {
    userId: v.id("users"),
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("appId"), args.appId))
      .first();
    if (!existing) return; // already not assigned

    await ctx.db.delete(existing._id);
  },
});
