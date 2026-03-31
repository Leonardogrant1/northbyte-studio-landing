import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        title: v.string(),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        videoUrl: v.string(),
        accountId: v.id("social_accounts"),
        scheduledAt: v.optional(v.number()),
        releaseUrl: v.optional(v.string()),
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
            videoUrl: args.videoUrl,
            accountId: args.accountId,
            scheduledAt: args.scheduledAt,
            releaseUrl: args.releaseUrl,
            status: "ready_to_post",
            createdBy: user._id,
            createdAt: Date.now(),
        });
    },
});
