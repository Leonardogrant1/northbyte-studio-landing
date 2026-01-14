import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Create a new feature
export const create = mutation({
    args: {
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("features", {
            appId: args.appId,
            title: args.title,
            description: args.description,
            upvotes: 0,
            status: args.status,
        });
    },
});

// Update a feature
export const update = mutation({
    args: {
        featureId: v.id("features"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { featureId, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        await ctx.db.patch(featureId, filteredUpdates);
        return featureId;
    },
});

// Upvote a feature
export const upvote = mutation({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        const feature = await ctx.db.get(args.featureId);
        if (!feature) throw new Error("Feature not found");

        await ctx.db.patch(args.featureId, {
            upvotes: feature.upvotes + 1,
        });
    },
});

// Subscribe to feature updates
export const subscribe = mutation({
    args: {
        featureId: v.id("features"),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if already subscribed
        const existing = await ctx.db
            .query("featureSubscribers")
            .withIndex("by_email_feature", (q) =>
                q.eq("email", args.email).eq("featureId", args.featureId)
            )
            .first();

        if (existing) return existing._id;

        return await ctx.db.insert("featureSubscribers", {
            email: args.email,
            featureId: args.featureId,
        });
    },
});

// Unsubscribe from feature updates
export const unsubscribe = mutation({
    args: {
        featureId: v.id("features"),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("featureSubscribers")
            .withIndex("by_email_feature", (q) =>
                q.eq("email", args.email).eq("featureId", args.featureId)
            )
            .first();

        if (subscription) {
            await ctx.db.delete(subscription._id);
        }
    },
});

// Delete a feature
export const remove = mutation({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.featureId);
    },
});
