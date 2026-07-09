import { query } from "../_generated/server";
import { v } from "convex/values";

export const getByEmailAndApp = query({
    args: {
        email: v.string(),
        app_id: v.id("apps"),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("creator_application")
            .filter((q) =>
                q.and(
                    q.eq(q.field("email"), args.email),
                    q.eq(q.field("app_id"), args.app_id),
                )
            )
            .first();
    },
});
