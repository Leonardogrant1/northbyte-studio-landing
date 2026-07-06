import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        app_id: v.id("apps"),
        name: v.string(),
        email: v.string(),
        phone: v.string(),
        country: v.string(),
        social_accounts: v.optional(v.array(v.string())),
        video_link: v.optional(v.string()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("creator_application", {
            app_id: args.app_id,
            name: args.name,
            email: args.email,
            phone: args.phone,
            country: args.country,
            social_accounts: args.social_accounts,
            video_link: args.video_link,
            description: args.description,
            status: "pending",
        });
    },
});

export const deleteRejected = mutation({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        const rejected = await ctx.db
            .query("creator_application")
            .filter((q) =>
                q.and(
                    q.eq(q.field("app_id"), args.appId),
                    q.eq(q.field("status"), "rejected"),
                )
            )
            .collect();
        await Promise.all(rejected.map((r) => ctx.db.delete(r._id)));
        return rejected.length;
    },
});
