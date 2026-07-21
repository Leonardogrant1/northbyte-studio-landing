import { mutation, MutationCtx } from "../_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const caller = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
  return caller;
}

// Code muss eindeutig sein über alle Profile UND offenen Invites hinweg.
async function assertCodeAvailable(ctx: MutationCtx, code: string, excludeProfileId?: string) {
  const codeInProfiles = await ctx.db
    .query("affiliate_profiles")
    .collect()
    .then((all) => all.some((p) => p.affiliateCode === code && p._id !== excludeProfileId));
  if (codeInProfiles) throw new Error(`Der Affiliate-Code "${code}" ist bereits vergeben.`);

  const openInvitesWithCode = await ctx.db
    .query("user_invites")
    .collect()
    .then((all) => all.some((i) => i.affiliateCode === code && i.usedAt === undefined));
  if (openInvitesWithCode) throw new Error(`Der Affiliate-Code "${code}" ist bereits in einer offenen Einladung vergeben.`);
}

// Admin-only — update commission settings and affiliate code for a profile.
export const update = mutation({
  args: {
    profileId: v.id("affiliate_profiles"),
    affiliateCode: v.string(),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed"), v.literal("flat")),
    commissionAmount: v.number(),
    isActive: v.boolean(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Affiliate profile not found.");

    const code = args.affiliateCode.trim();
    if (!code) throw new Error("Affiliate-Code darf nicht leer sein.");
    if (code !== profile.affiliateCode) {
      await assertCodeAvailable(ctx, code, args.profileId);
    }

    if (args.name !== undefined && !args.name.trim()) {
      throw new Error("Name darf nicht leer sein.");
    }

    await ctx.db.patch(args.profileId, {
      affiliateCode: code,
      commissionType: args.commissionType,
      commissionAmount: args.commissionAmount,
      isActive: args.isActive,
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
    });
  },
});

// Admin-only — create a standalone flat-deal profile (no user account, no login).
export const createStandalone = mutation({
  args: {
    name: v.string(),
    affiliateCode: v.string(),
    commissionAmount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("Name darf nicht leer sein.");
    const code = args.affiliateCode.trim();
    if (!code) throw new Error("Affiliate-Code darf nicht leer sein.");
    await assertCodeAvailable(ctx, code);

    return await ctx.db.insert("affiliate_profiles", {
      name,
      affiliateCode: code,
      commissionType: "flat",
      commissionAmount: args.commissionAmount,
      isActive: true,
    });
  },
});

// Admin-only — delete a standalone profile. Linked profiles must be deactivated instead.
export const removeStandalone = mutation({
  args: { profileId: v.id("affiliate_profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Affiliate-Profil nicht gefunden.");
    if (profile.userId !== undefined) {
      throw new Error("Profile mit verknüpftem User können nicht gelöscht werden — bitte deaktivieren.");
    }

    const hasReferrals = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.profileId))
      .first();
    if (hasReferrals) {
      throw new Error("Dieses Profil hat bereits Referrals und kann nicht gelöscht werden — bitte deaktivieren.");
    }

    await ctx.db.delete(args.profileId);
  },
});
