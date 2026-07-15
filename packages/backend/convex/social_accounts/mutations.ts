import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        platform: v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("x")),
        isAI: v.boolean(),
        username: v.string(),
        platformId: v.optional(v.string()),
        bio: v.optional(v.string()),
        followers: v.optional(v.number()),
        following: v.optional(v.number()),
        likes: v.optional(v.number()),
        profileImageUrl: v.optional(v.string()),
        assignedTo: v.optional(v.id("users")),
        avatarId: v.optional(v.id("ai_avatars")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        // AI accounts must have an avatar assigned
        if (args.isAI && !args.avatarId) {
            throw new Error("AI-Accounts müssen einem Avatar zugeordnet sein.");
        }

        return await ctx.db.insert("social_accounts", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

export const update = mutation({
    args: {
        id: v.id("social_accounts"),
        platform: v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("x")),
        isAI: v.boolean(),
        username: v.string(),
        platformId: v.optional(v.string()),
        postizId: v.optional(v.string()),
        timezone: v.optional(v.string()),
        postingTimes: v.optional(v.array(v.string())),
        bio: v.optional(v.string()),
        followers: v.optional(v.number()),
        following: v.optional(v.number()),
        likes: v.optional(v.number()),
        profileImageUrl: v.optional(v.string()),
        assignedTo: v.optional(v.id("users")),
        avatarId: v.optional(v.id("ai_avatars")),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        if (args.isAI && !args.avatarId) {
            throw new Error("AI-Accounts müssen einem Avatar zugeordnet sein.");
        }

        const { id, ...fields } = args;
        await ctx.db.patch(id, fields);
    },
});

export const remove = mutation({
    args: { id: v.id("social_accounts") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        await ctx.db.delete(args.id);
    },
});
