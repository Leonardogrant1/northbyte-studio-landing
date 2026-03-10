import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("vendors")
            .withIndex("by_name", (q) => q.eq("name", args.name))
            .first();

        if (existing) {
            return existing._id;
        }

        return await ctx.db.insert("vendors", {
            name: args.name,
        });
    },
});
