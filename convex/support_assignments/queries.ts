import { query } from "../_generated/server";
import { v } from "convex/values";

// Returns all app documents assigned to a support user.
export const getAppsForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assignments = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const apps = await Promise.all(
      assignments.map((a) => ctx.db.get(a.appId))
    );
    return apps.filter((a): a is NonNullable<typeof a> => a !== null);
  },
});

// Returns all user documents assigned to a given app.
export const getUsersForApp = query({
  args: { appId: v.id("apps") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assignments = await ctx.db
      .query("support_assignments")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();

    const users = await Promise.all(
      assignments.map((a) => ctx.db.get(a.userId))
    );
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});
