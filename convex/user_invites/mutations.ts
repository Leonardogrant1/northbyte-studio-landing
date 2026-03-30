import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — create a new invite.
export const create = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("creator")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    // Check if an open invite for this email already exists
    const existing = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();
    const alreadyOpen = existing.some((i) => i.usedAt === undefined);
    if (alreadyOpen) throw new Error("Es gibt bereits eine offene Einladung für diese E-Mail.");

    return await ctx.db.insert("user_invites", {
      email: args.email.toLowerCase(),
      role: args.role,
      invitedBy: caller._id,
      createdAt: Date.now(),
    });
  },
});

// Admin-only — revoke (delete) an open invite.
export const remove = mutation({
  args: { inviteId: v.id("user_invites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Einladung nicht gefunden.");
    if (invite.usedAt !== undefined) throw new Error("Eingelöste Einladungen können nicht widerrufen werden.");

    await ctx.db.delete(args.inviteId);
  },
});
