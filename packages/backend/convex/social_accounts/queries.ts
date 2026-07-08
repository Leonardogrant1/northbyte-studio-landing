import { query } from "../_generated/server";

export const getWithPostizId = query({
    args: {},
    handler: async (ctx) => {
        const accounts = await ctx.db.query("social_accounts").collect();
        return accounts.filter((a) => a.postizId !== undefined && a.postizId !== null);
    },
});

export const getAll = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        return await ctx.db
            .query("social_accounts")
            .order("desc")
            .collect();
    },
});

// Returns accounts assigned to the current user (creator) or all accounts (admin).
export const getMyAccounts = query({
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
            return await ctx.db.query("social_accounts").order("desc").collect();
        }

        return await ctx.db
            .query("social_accounts")
            .withIndex("by_assigned", (q) => q.eq("assignedTo", user._id))
            .order("desc")
            .collect();
    },
});
