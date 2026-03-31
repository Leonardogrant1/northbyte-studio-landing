import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createMedia = mutation({
    args: {
        title: v.string(),
        type: v.union(v.literal("video"), v.literal("image")),
        fileUrl: v.string(),
        thumbnailUrl: v.string(),
        appId: v.optional(v.id("apps")),
        avatarId: v.optional(v.id("ai_avatars")),
        gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("diverse"))),
        skinTone: v.optional(v.union(v.literal("white"), v.literal("black"), v.literal("light-skin"), v.literal("asian"), v.literal("indian"), v.literal("brown"))),
        contentType: v.optional(v.union(v.literal("creator"), v.literal("demo"))),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        return await ctx.db.insert("media", {
            ...args,
            uploadedBy: user._id,
            createdAt: Date.now(),
        });
    },
});

export const deleteMedia = mutation({
    args: { mediaId: v.id("media") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        const item = await ctx.db.get(args.mediaId);
        if (!item) throw new Error("Media not found.");

        const isOwner = item.uploadedBy === user._id;
        const isAdmin = user.type === "admin";
        if (!isOwner && !isAdmin) throw new Error("Not authorized to delete this media.");

        await ctx.db.delete(args.mediaId);
    },
});
