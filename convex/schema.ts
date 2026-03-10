import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Users - central entity linked to Clerk
    users: defineTable({
        clerkId: v.string(),
        email: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_clerk", ["clerkId"]),

    // Apps - applications that can have bugs and features
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
    }),
    // Bugs - bug reports for apps
    bugs: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    // Features - feature requests for apps
    features: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    // Bug Subscribers - users subscribed to bug updates
    bugSubscribers: defineTable({
        email: v.string(),
        bugId: v.id("bugs"),
    })
        .index("by_bug", ["bugId"])
        .index("by_email_bug", ["email", "bugId"]),

    // Feature Subscribers - users subscribed to feature updates
    featureSubscribers: defineTable({
        email: v.string(),
        featureId: v.id("features"),
    })
        .index("by_feature", ["featureId"])
        .index("by_email_feature", ["email", "featureId"]),


    vendors: defineTable({
        name: v.string(),        // "tiktok", "google_cloud"
    }).index("by_name", ["name"]),

    categories: defineTable({
        name: v.string(),        // "advertising", "infrastructure"
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
    }).index("by_vendor", ["vendor_id"])
        .index("by_category", ["category_id"])
        .index("by_vendor_invoice", ["vendor_id", "vendor_invoice_id"])
        .index("by_vendor_receipt", ["vendor_id", "vendor_receipt_id"]),
});
