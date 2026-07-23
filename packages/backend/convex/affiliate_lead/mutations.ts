import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Public — called from external app landing pages via POST /api/affiliate/lead/view.
// Looks up the app by slug and the affiliate profile by code, then upserts the lead:
// repeat visits in the same session bump viewCount instead of creating new rows.
export const logView = mutation({
  args: {
    appSlug: v.string(),
    affiliateCode: v.string(),
    sessionId: v.string(),
    referer: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .filter((q) => q.eq(q.field("slug"), args.appSlug))
      .first();
    if (!app) return { error: "not_found", message: `App with slug "${args.appSlug}" not found.` } as const;

    // Case-insensitive: Links kommen lowercase an, die Codes stehen uppercase in der DB.
    const profiles = await ctx.db.query("affiliate_profiles").collect();
    const profile = profiles.find(
      (p) => p.affiliateCode.toUpperCase() === args.affiliateCode.toUpperCase(),
    );
    if (!profile) return { error: "not_found", message: `Affiliate code "${args.affiliateCode}" not found.` } as const;
    if (!profile.isActive) return { error: "inactive", message: `Affiliate code "${args.affiliateCode}" is inactive.` } as const;

    const now = Date.now();

    const existing = await ctx.db
      .query("affiliate_lead")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("affiliateId"), profile._id))
      .filter((q) => q.eq(q.field("appId"), app._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        viewCount: existing.viewCount + 1,
        updatedAt: now,
      });
      return { leadId: existing._id };
    }

    const leadId = await ctx.db.insert("affiliate_lead", {
      affiliateId: profile._id,
      appId: app._id,
      sessionId: args.sessionId,
      status: "viewed",
      referer: args.referer,
      country: args.country,
      viewCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    return { leadId };
  },
});

// Public — called via POST /api/affiliate/lead/store-click.
// Upgrades all leads of the session (for this app) once it heads to a store. Idempotent.
export const markStoreClick = mutation({
  args: {
    appSlug: v.string(),
    sessionId: v.string(),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const app = await ctx.db
      .query("apps")
      .filter((q) => q.eq(q.field("slug"), args.appSlug))
      .first();
    if (!app) return { error: "not_found", message: `App with slug "${args.appSlug}" not found.` } as const;

    const leads = await ctx.db
      .query("affiliate_lead")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("appId"), app._id))
      .collect();

    const now = Date.now();
    for (const lead of leads) {
      await ctx.db.patch(lead._id, {
        status: "store_clicked",
        platform: args.platform ?? lead.platform,
        updatedAt: now,
      });
    }

    return { updated: leads.length };
  },
});
