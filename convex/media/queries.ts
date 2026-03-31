import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAll = query({
    args: {
        appId: v.optional(v.id("apps")),
        avatarId: v.optional(v.id("ai_avatars")),
        uploadedBy: v.optional(v.id("users")),
        type: v.optional(v.union(v.literal("video"), v.literal("image"))),
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

        const isAdmin = user.type === "admin";

        let items = args.uploadedBy
            ? await ctx.db.query("media").withIndex("by_uploader", (q) => q.eq("uploadedBy", args.uploadedBy!)).collect()
            : args.avatarId
            ? await ctx.db.query("media").withIndex("by_avatar", (q) => q.eq("avatarId", args.avatarId!)).collect()
            : args.appId
            ? await ctx.db.query("media").withIndex("by_app", (q) => q.eq("appId", args.appId!)).collect()
            : await ctx.db.query("media").collect();

        if (args.appId && !args.uploadedBy && !args.avatarId) { /* already filtered by index */ }
        else if (args.appId) items = items.filter((i) => i.appId === args.appId);
        if (args.avatarId && args.uploadedBy) items = items.filter((i) => i.avatarId === args.avatarId);
        if (args.type) items = items.filter((i) => i.type === args.type);
        if (args.gender) items = items.filter((i) => i.gender === args.gender);
        if (args.skinTone) items = items.filter((i) => i.skinTone === args.skinTone);
        if (args.contentType) items = items.filter((i) => i.contentType === args.contentType);
        if (args.language) items = items.filter((i) => i.language === args.language);

        // Creators only see their own "creator" content; demo content is visible to all.
        if (!isAdmin) {
            items = items.filter(
                (i) => i.contentType !== "creator" || i.uploadedBy === user._id
            );
        }

        return items.sort((a, b) => b.createdAt - a.createdAt);
    },
});
