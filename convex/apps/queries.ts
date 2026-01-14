import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all apps
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("apps").collect();
    },
});

// Get a single app by ID
export const getById = query({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.appId);
    },
});

// Get apps by status
export const getByStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("apps")
            .filter((q) => q.eq(q.field("status"), args.status))
            .collect();
    },
});
