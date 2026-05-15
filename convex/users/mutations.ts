import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

// Called from Clerk webhook — creates user with role.
// Falls back to "admin" for @northbyte.studio emails (existing accounts migration).
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    type: v.optional(v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    // Determine role: explicit type > northbyte fallback > default creator
    let type: "admin" | "creator" | "affiliate" = args.type ?? "creator";
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

    return userId;
  },
});
