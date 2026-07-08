import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

export const getReadyToPostByAccount = query({
    args: { accountId: v.id("social_accounts") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("posts")
            .withIndex("by_status", (q) => q.eq("status", "ready_to_post"))
            .filter((q) => q.eq(q.field("accountId"), args.accountId))
            .collect();
    },
});

export const getMyPosts = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        if (user.type === "admin") {
            return await ctx.db.query("posts").order("desc").collect();
        }

        return await ctx.db
            .query("posts")
            .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
            .order("desc")
            .collect();
    },
});

// Returns the last 20 posts enriched with account info.
// Admin sees all; creator sees only their own.
export const getRecent = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        const limit = args.limit ?? 20;

        let posts;
        if (user.type === "admin") {
            posts = await ctx.db.query("posts").order("desc").take(limit);
        } else {
            posts = await ctx.db
                .query("posts")
                .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
                .order("desc")
                .take(limit);
        }

        // Enrich with social account data
        return await Promise.all(
            posts.map(async (post) => {
                const account = await ctx.db.get(post.accountId);
                return {
                    ...post,
                    account: account
                        ? { username: account.username, platform: account.platform }
                        : null,
                };
            })
        );
    },
});

export const getLastScheduledByAccount = query({
    args: { accountId: v.id("social_accounts"), limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("posts")
            .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
            .order("desc")
            .filter((q) => q.neq(q.field("scheduledAt"), undefined))
            .take(args.limit ?? 10);
    },
});

// Returns post counts grouped by status for the current user.
// Admin sees counts across all posts; creator sees only their own.
export const getMyPostStats = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        let posts;
        if (user.type === "admin") {
            posts = await ctx.db.query("posts").collect();
        } else {
            posts = await ctx.db
                .query("posts")
                .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
                .collect();
        }

        const stats = { ready_to_post: 0, scheduled: 0, posted: 0, failed: 0, total: 0 };
        for (const post of posts) {
            stats.total++;
            if (post.status === "ready_to_post") stats.ready_to_post++;
            else if (post.status === "scheduled") stats.scheduled++;
            else if (post.status === "posted") stats.posted++;
            else if (post.status === "failed") stats.failed++;
        }
        return stats;
    },
});
