import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Create a new app
export const create = mutation({
    args: {
        name: v.string(),
        tagline: v.string(),
        description: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("apps", {
            name: args.name,
            tagline: args.tagline,
            description: args.description,
            status: args.status,
        });
    },
});

// Update an existing app
export const update = mutation({
    args: {
        appId: v.id("apps"),
        name: v.optional(v.string()),
        tagline: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { appId, ...updates } = args;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        await ctx.db.patch(appId, filteredUpdates);
        return appId;
    },
});

// Delete an app
export const remove = mutation({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.appId);
    },
});
