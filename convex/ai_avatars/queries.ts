import { query } from "../_generated/server";

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return [];

        return await ctx.db
            .query("ai_avatars")
            .order("desc")
            .collect();
    },
});
