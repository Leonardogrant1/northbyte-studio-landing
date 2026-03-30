import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// NOTE: Existing users documents without a `type` field must be backfilled
// via the Convex dashboard to `type: "admin"` before deployment.

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.optional(v.string()),
        type: v.union(v.literal("admin"), v.literal("creator")),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_clerk", ["clerkId"]),

    user_invites: defineTable({
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("creator")),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        usedAt: v.optional(v.number()),
    }).index("by_email", ["email"]),

    apps: defineTable({
        name: v.string(),
        domain: v.optional(v.string()),
        tagline: v.string(),
        logoStorageId: v.optional(v.id("_storage")),
        thumbnailStorageId: v.optional(v.id("_storage")),
        slug: v.string(),
        description: v.string(),
        status: v.string(),
        revenueCatProjectId: v.optional(v.string()),
        revenueCatApiKeyEncrypted: v.optional(v.string()),
        postHogProjectId: v.optional(v.string()),
        postHogApiKeyEncrypted: v.optional(v.string()),
        postHogInstallEvent: v.optional(v.string()),
        postHogTrialEvent: v.optional(v.string()),
        termsOfUse: v.optional(v.string()),
        privacyPolicy: v.optional(v.string()),
    }),

    bugs: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    features: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    bugSubscribers: defineTable({
        email: v.string(),
        bugId: v.id("bugs"),
    })
        .index("by_bug", ["bugId"])
        .index("by_email_bug", ["email", "bugId"]),

    featureSubscribers: defineTable({
        email: v.string(),
        featureId: v.id("features"),
    })
        .index("by_feature", ["featureId"])
        .index("by_email_feature", ["email", "featureId"]),

    vendors: defineTable({
        name: v.string(),
    }).index("by_name", ["name"]),

    categories: defineTable({
        name: v.string(),
    }).index("by_name", ["name"]),

    expenses: defineTable({
        description: v.string(),
        vendor_invoice_id: v.optional(v.string()),
        vendor_receipt_id: v.optional(v.string()),
        vendor_id: v.id("vendors"),
        category_id: v.id("categories"),
        original_amount: v.number(),
        original_currency: v.string(),
        amount_usd: v.number(),
        tax_amount: v.optional(v.number()),
        date: v.string(),
        urls: v.optional(v.array(v.string())),
    })
        .index("by_vendor", ["vendor_id"])
        .index("by_category", ["category_id"])
        .index("by_vendor_invoice", ["vendor_id", "vendor_invoice_id"])
        .index("by_vendor_receipt", ["vendor_id", "vendor_receipt_id"]),
});
