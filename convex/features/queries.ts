import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all features for an app, sorted by upvotes (descending)
export const getByApp = query({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        const features = await ctx.db
            .query("features")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .collect();
        
        // Sort by upvotes descending
        return features.sort((a, b) => b.upvotes - a.upvotes);
    },
});

// Get a single feature by ID
export const getById = query({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.featureId);
    },
});

// Get features by status for an app
export const getByStatus = query({
    args: {
        appId: v.id("apps"),
        status: v.string()
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("features")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .filter((q) => q.eq(q.field("status"), args.status))
            .collect();
    },
});

// Get top features by upvotes for an app
export const getTopByUpvotes = query({
    args: {
        appId: v.id("apps"),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const features = await ctx.db
            .query("features")
            .withIndex("by_app", (q) => q.eq("appId", args.appId))
            .collect();

        return features
            .sort((a, b) => b.upvotes - a.upvotes)
            .slice(0, args.limit ?? 10);
    },
});

// Get subscribers for a feature
export const getSubscribers = query({
    args: { featureId: v.id("features") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("featureSubscribers")
            .withIndex("by_feature", (q) => q.eq("featureId", args.featureId))
            .collect();
    },
});

// Check if an email is subscribed to a feature
export const isSubscribed = query({
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
        
        return subscription !== null;
    },
});
