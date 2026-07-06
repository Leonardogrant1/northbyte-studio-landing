import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        mediaUrls: v.array(v.string()),
        accountId: v.id("social_accounts"),
        scheduledAt: v.optional(v.number()),
        releaseUrl: v.optional(v.string()),
        postizPostId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        return await ctx.db.insert("posts", {
            title: args.title,
            description: args.description,
            hashtags: args.hashtags,
            mediaUrls: args.mediaUrls,
            accountId: args.accountId,
            scheduledAt: args.scheduledAt,
            releaseUrl: args.releaseUrl,
            postizPostId: args.postizPostId,
            status: args.postizPostId ? "scheduled" : "ready_to_post",
            createdBy: user._id,
            createdAt: Date.now(),
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("posts"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        videoUrl: v.optional(v.string()),
        mediaUrls: v.optional(v.array(v.string())),
        accountId: v.optional(v.id("social_accounts")),
        scheduledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        const post = await ctx.db.get(args.id);
        if (!post) throw new Error("Post not found.");

        if (user.type !== "admin" && post.createdBy !== user._id) {
            throw new Error("Unauthorized.");
        }

        if (post.status !== "ready_to_post") {
            throw new Error("Only ready_to_post posts can be edited.");
        }

        const { id, ...fields } = args;
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) patch[key] = value;
        }

        await ctx.db.patch(id, patch);
    },
});
