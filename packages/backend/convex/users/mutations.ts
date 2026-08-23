import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

// Called from Clerk webhook — creates user with role.
// Falls back to "admin" for @northbyte.studio emails (existing accounts migration).
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    type: v.optional(v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    // Determine role: explicit type > northbyte fallback > default creator
    let type: "admin" | "creator" | "affiliate" | "support" = args.type ?? "creator";
    if (!args.type && args.email?.endsWith("@northbyte.studio")) {
      type = "admin";
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      type,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Called from signup page after Clerk verification completes.
// Creates (or updates) the user with the role from a valid invite.
// Marks the invite as used.
export const createUserFromInvite = mutation({
  args: {
    inviteId: v.id("user_invites"),
    name: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found.");
    if (invite.usedAt !== undefined) throw new Error("This invite has already been used.");
    if (invite.email !== identity.email?.toLowerCase()) {
      throw new Error("This invite was not issued to your account.");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    let userId;
    if (existing) {
      // Webhook may have already created the user — update their type and name
      await ctx.db.patch(existing._id, {
        type: invite.role,
        name: args.name,
        lastName: args.lastName,
        aiLabVisible: invite.aiLabVisible,
        updatedAt: now,
      });
      userId = existing._id;
    } else {
      userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email,
        name: args.name,
        lastName: args.lastName,
        type: invite.role,
        aiLabVisible: invite.aiLabVisible,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.inviteId, { usedAt: now });

    // If affiliate, create the affiliate profile with the code from the invite
    if (invite.role === "affiliate" && invite.affiliateCode) {
      await ctx.db.insert("affiliate_profiles", {
        userId,
        affiliateCode: invite.affiliateCode,
        commissionType: invite.commissionType ?? "percentage",
        commissionAmount: invite.commissionAmount ?? 10,
        isActive: true,
      });
    }

    // If support or creator, create app assignments from the invite
    if ((invite.role === "support" || invite.role === "creator") && invite.appIds && invite.appIds.length > 0) {
      await Promise.all(
        invite.appIds.map((appId) =>
          ctx.db.insert("user_app_assignments", { userId, appId })
        )
      );
    }

    return userId;
  },
});

// Admin-only — löscht einen User samt persönlicher Daten: App-Zuweisungen,
// Attachment-Datensätze sowie sein Affiliate-Profil inklusive Referrals und
// Leads (die Referral-/Umsatzhistorie geht damit bewusst verloren). Inhalte
// bleiben erhalten: Medien, Posts und Ticket-Nachrichten behalten ihre (dann
// ins Leere zeigende) Referenz. Clerk-Account und R2-Dateien löscht die
// Next.js-Route /api/users/delete, die diese Mutation aufruft.
export const deleteUser = mutation({
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
    if (!target) throw new Error("User not found");
    if (target._id === caller._id) throw new Error("Eigener Account kann nicht gelöscht werden");
    if (target.type === "admin") throw new Error("Admins können nicht gelöscht werden");

    // Affiliate-Profil mitsamt Referrals und Leads löschen — verwaiste Referrals
    // wären unsichtbar, weil die Admin-Übersicht über Profile iteriert.
    const profiles = await ctx.db
      .query("affiliate_profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const profile of profiles) {
      const referrals = await ctx.db
        .query("affiliate_referral")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
        .collect();
      for (const referral of referrals) {
        await ctx.db.delete(referral._id);
      }

      const leads = await ctx.db
        .query("affiliate_lead")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
        .collect();
      for (const lead of leads) {
        await ctx.db.delete(lead._id);
      }

      await ctx.db.delete(profile._id);
    }

    const assignments = await ctx.db
      .query("user_app_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    const attachments = await ctx.db
      .query("user_attachments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const attachment of attachments) {
      await ctx.db.delete(attachment._id);
    }

    const socialAccounts = await ctx.db
      .query("social_accounts")
      .withIndex("by_assigned", (q) => q.eq("assignedTo", args.userId))
      .collect();
    for (const account of socialAccounts) {
      await ctx.db.patch(account._id, { assignedTo: undefined });
    }

    await ctx.db.delete(args.userId);
  },
});

// Admin-only — toggle AI-Lab visibility for a user (relevant for creators).
export const setAiLabVisible = mutation({
  args: {
    userId: v.id("users"),
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      aiLabVisible: args.visible,
      updatedAt: Date.now(),
    });
  },
});
