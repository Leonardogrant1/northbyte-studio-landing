import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Public query — no auth required. Used by signup page before user has an account.
// Returns the most recent open invite for the given email, or null.
export const getOpenInviteByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();

    const open = invites.filter((i) => i.usedAt === undefined);
    if (open.length === 0) return null;

    // Return the most recently created open invite
    return open.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});

// Admin-only query — returns all invites for the User & Roles page.
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") return null;

    return await ctx.db.query("user_invites").order("desc").collect();
  },
});

// Public query — used by the signup page when arriving via a magic link token.
// Returns the open invite for this token, or null if not found / already used.
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("user_invites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!invite) return null;
    if (invite.usedAt !== undefined) return null;
    return invite;
  },
});

// Internal version — used by the webhook (no auth check needed, called server-side).
export const getOpenInviteByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();

    const open = invites.filter((i) => i.usedAt === undefined);
    if (open.length === 0) return null;
    return open.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});
