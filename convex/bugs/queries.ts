import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all bugs for an app
export const getByApp = query({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bugs")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .collect();
    },
});

// Get a single bug by ID
export const getById = query({
    args: { bugId: v.id("bugs") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.bugId);
    },
});

// Get bugs by status for an app
export const getByStatus = query({
    args: {
        appId: v.id("apps"),
        status: v.string()
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bugs")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .filter((q) => q.eq(q.field("status"), args.status))
            .collect();
    },
});

// Get top bugs by upvotes for an app
export const getTopByUpvotes = query({
    args: {
        appId: v.id("apps"),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const bugs = await ctx.db
            .query("bugs")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .collect();

        return bugs
            .sort((a, b) => b.upvotes - a.upvotes)
            .slice(0, args.limit ?? 10);
    },
});

// Get subscribers for a bug
export const getSubscribers = query({
    args: { bugId: v.id("bugs") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("bugSubscribers")
            .withIndex("by_bug", (q) => q.eq("bugId", args.bugId))
            .collect();
    },
});
