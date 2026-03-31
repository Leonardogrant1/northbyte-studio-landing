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

    media: defineTable({
        title: v.string(),
        type: v.union(v.literal("video"), v.literal("image")),
        fileUrl: v.string(),
        thumbnailUrl: v.string(),
        appId: v.optional(v.id("apps")),
        avatarId: v.optional(v.id("ai_avatars")),
        gender: v.optional(v.union(
            v.literal("male"),
            v.literal("female"),
            v.literal("diverse")
        )),
        skinTone: v.optional(v.union(
            v.literal("white"),
            v.literal("black"),
            v.literal("light-skin"),
            v.literal("asian"),
            v.literal("indian"),
            v.literal("brown")
        )),
        contentType: v.optional(v.union(v.literal("creator"), v.literal("demo"))),
        language: v.optional(v.string()),
        uploadedBy: v.id("users"),
        createdAt: v.number(),
    })
        .index("by_app", ["appId"])
        .index("by_type", ["type"])
        .index("by_uploader", ["uploadedBy"])
        .index("by_avatar", ["avatarId"]),

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

    ai_avatars: defineTable({
        name: v.string(),
        imageUrl: v.string(),
        description: v.string(),
        gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("diverse"))),
        ethnicity: v.optional(v.union(
            v.literal("white"),
            v.literal("black"),
            v.literal("light-skin"),
            v.literal("asian"),
            v.literal("indian"),
            v.literal("brown")
        )),
        country: v.optional(v.union(v.literal("de"), v.literal("br"), v.literal("us"))),
        language: v.optional(v.string()),
        createdAt: v.number(),
    }),

    social_accounts: defineTable({
        platform: v.union(v.literal("tiktok"), v.literal("instagram")),
        isAI: v.boolean(),
        username: v.string(),
        platformId: v.optional(v.string()),
        postizId: v.optional(v.string()),
        timezone: v.optional(v.string()),
        postingTimes: v.optional(v.array(v.string())),
        bio: v.optional(v.string()),
        followers: v.optional(v.number()),
        following: v.optional(v.number()),
        likes: v.optional(v.number()),
        profileImageUrl: v.optional(v.string()),
        assignedTo: v.optional(v.id("users")),
        avatarId: v.optional(v.id("ai_avatars")),
        createdAt: v.number(),
    })
        .index("by_platform", ["platform"])
        .index("by_assigned", ["assignedTo"]),

    kling_tasks: defineTable({
        taskId: v.string(),
        prompt: v.string(),
        imageUrl: v.string(),
        videoUrl: v.string(),
        status: v.union(
            v.literal("submitted"),
            v.literal("processing"),
            v.literal("succeed"),
            v.literal("failed")
        ),
        resultUrl: v.optional(v.string()),
        createdBy: v.id("users"),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_task", ["taskId"])
        .index("by_creator", ["createdBy"]),

    posts: defineTable({
        title: v.string(),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        videoUrl: v.string(),
        accountId: v.id("social_accounts"),
        status: v.union(v.literal("scheduled"), v.literal("posted"), v.literal("failed"), v.literal("ready_to_post")),
        scheduledAt: v.optional(v.number()),
        releaseUrl: v.optional(v.string()),
        postizPostId: v.optional(v.string()),
        likes: v.optional(v.number()),
        comments: v.optional(v.number()),
        shares: v.optional(v.number()),
        views: v.optional(v.number()),
        reposts: v.optional(v.number()),
        createdBy: v.id("users"),
        createdAt: v.number(),
    })
        .index("by_creator", ["createdBy"])
        .index("by_status", ["status"]),

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
