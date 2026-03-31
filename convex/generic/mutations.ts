import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const updateById = mutation({
    args: { id: v.string(), patch: v.any() },
    handler: async (ctx, args) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.db.patch(args.id as any, args.patch);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await ctx.db.get(args.id as any);
    },
});
