import { query } from "../_generated/server";
import { v } from "convex/values";

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
