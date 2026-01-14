import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

// Create a new user (called from Clerk webhook)
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists (idempotent)
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      createdAt: now,
      updatedAt: now,
    });
  },
});
