import { query } from "../_generated/server";

export const getMyTasks = query({
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
            return await ctx.db.query("kling_tasks").order("desc").collect();
        }

        return await ctx.db
            .query("kling_tasks")
            .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
            .order("desc")
            .collect();
    },
});
