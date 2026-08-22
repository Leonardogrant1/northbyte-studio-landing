import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// Get current user with subscription details
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    console.log("identity", identity);

    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;

    return user;
  },
});

// Internal query to get user by ID (for actions)
export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return user;
  },
});

// Admin-only — returns all registered users for dropdowns etc.
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("users").order("desc").collect();
  },
});

// Admin-only — Infos für die User-Lösch-Route: clerkId fürs Clerk-Delete und
// die R2-Keys der Anhänge fürs Storage-Cleanup. Validiert dieselben Guards wie
// deleteUser, damit die Route gar nicht erst mit dem Löschen beginnt.
export const getDeletionInfo = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const target = await ctx.db.get(args.userId);
    if (!target) return null;
    if (target._id === caller._id) throw new Error("Eigener Account kann nicht gelöscht werden");
    if (target.type === "admin") throw new Error("Admins können nicht gelöscht werden");

    const attachments = await ctx.db
      .query("user_attachments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      clerkId: target.clerkId,
      fileKeys: attachments.map((a) => a.fileKey),
    };
  },
});

// Admin-only — paginated version for the User & Roles page.
export const getAllUsersPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
  },
});
