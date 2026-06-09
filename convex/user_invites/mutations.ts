import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — create a new invite.
export const create = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
    token: v.optional(v.string()),
    affiliateCode: v.optional(v.string()),
    commissionType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    commissionAmount: v.optional(v.number()),
    appIds: v.optional(v.array(v.id("apps"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    if (args.role === "affiliate" && !args.affiliateCode) {
      throw new Error("Ein Affiliate-Code ist für Affiliate-Einladungen erforderlich.");
    }

    // Check if affiliate code is already taken (in profiles or in open invites)
    if (args.affiliateCode) {
      const codeInProfiles = await ctx.db
        .query("affiliate_profiles")
        .collect()
        .then((all) => all.some((p) => p.affiliateCode === args.affiliateCode));
      if (codeInProfiles) throw new Error(`Der Affiliate-Code "${args.affiliateCode}" ist bereits vergeben.`);

      const openInvitesWithCode = await ctx.db
        .query("user_invites")
        .collect()
        .then((all) => all.some((i) => i.affiliateCode === args.affiliateCode && i.usedAt === undefined));
      if (openInvitesWithCode) throw new Error(`Der Affiliate-Code "${args.affiliateCode}" ist bereits in einer offenen Einladung vergeben.`);
    }

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
      token: args.token,
      affiliateCode: args.affiliateCode,
      commissionType: args.commissionType,
      commissionAmount: args.commissionAmount,
      appIds: args.appIds,
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

    await ctx.db.delete(args.inviteId);
  },
});
