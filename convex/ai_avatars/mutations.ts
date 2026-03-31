import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        name: v.string(),
        imageUrl: v.string(),
        description: v.string(),
        gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("diverse"))),
        ethnicity: v.optional(v.union(
            v.literal("white"),
            v.literal("black"),
            v.literal("light-skin"),
            v.literal("asian"),
            v.literal("indian"),
            v.literal("brown")
        )),
        country: v.optional(v.union(v.literal("de"), v.literal("br"), v.literal("us"))),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        return await ctx.db.insert("ai_avatars", {
            ...args,
            createdAt: Date.now(),
        });
    },
});

export const remove = mutation({
    args: { id: v.id("ai_avatars") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        await ctx.db.delete(args.id);
    },
});
