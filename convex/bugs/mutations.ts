import { mutation } from "../_generated/server.js";
import { v } from "convex/values";
import { api } from "../_generated/api.js";

// Create a new bug
export const create = mutation({
    args: {
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("bugs", {
            appId: args.appId,
            title: args.title,
            description: args.description,
            upvotes: 0,
            status: args.status,
        });
    },
});

// Update a bug
export const update = mutation({
    args: {
        bugId: v.id("bugs"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { bugId, ...updates } = args;

        // Get current bug to check if status is changing to "resolved"
        const currentBug = await ctx.db.get(bugId);
        if (!currentBug) throw new Error("Bug not found");

        const oldStatus = currentBug.status;
        const newStatus = args.status;

        // Filter out undefined values
        const filteredUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, value]) => value !== undefined)
        );

        await ctx.db.patch(bugId, filteredUpdates);

        // Notify subscribers if status changed to "resolved"
        if (newStatus && newStatus === "resolved" && oldStatus !== "resolved") {
            // Schedule notification (don't await to avoid blocking)
            ctx.scheduler.runAfter(0, api.bugs.actions.notifySubscribers, {
                bugId: bugId,
                newStatus: newStatus,
            });
        }

        return bugId;
    },
});

// Upvote a bug
export const upvote = mutation({
    args: { bugId: v.id("bugs") },
    handler: async (ctx, args) => {
        const bug = await ctx.db.get(args.bugId);
        if (!bug) throw new Error("Bug not found");

        await ctx.db.patch(args.bugId, {
            upvotes: bug.upvotes + 1,
        });
    },
});

// Subscribe to bug updates
export const subscribe = mutation({
    args: {
        bugId: v.id("bugs"),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if already subscribed
        const existing = await ctx.db
            .query("bugSubscribers")
            .withIndex("by_email_bug", (q) =>
                q.eq("email", args.email).eq("bugId", args.bugId)
            )
            .first();

        if (existing) return existing._id;

        return await ctx.db.insert("bugSubscribers", {
            email: args.email,
            bugId: args.bugId,
        });
    },
});

// Unsubscribe from bug updates
export const unsubscribe = mutation({
    args: {
        bugId: v.id("bugs"),
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("bugSubscribers")
            .withIndex("by_email_bug", (q) =>
                q.eq("email", args.email).eq("bugId", args.bugId)
            )
            .first();

        if (subscription) {
            await ctx.db.delete(subscription._id);
        }
    },
});

// Delete a bug
export const remove = mutation({
    args: { bugId: v.id("bugs") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.bugId);
    },
});
