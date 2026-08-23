import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// NOTE: Existing users documents without a `type` field must be backfilled
// via the Convex dashboard to `type: "admin"` before deployment.

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        lastName: v.optional(v.string()),
        type: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
        aiLabVisible: v.optional(v.boolean()), // Creator only: undefined/false = AI-Lab ausgeblendet
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_clerk", ["clerkId"]),

    affiliate_profiles: defineTable({
        userId: v.optional(v.id("users")),   // undefined = Standalone-Profil (Pauschal-Deal ohne Login)
        name: v.optional(v.string()),        // Anzeigename für Standalone-Profile; sonst kommt der Name aus users
        affiliateCode: v.string(),
        commissionType: v.union(v.literal("percentage"), v.literal("fixed"), v.literal("flat")),
        commissionAmount: v.number(),        // bei "flat": gezahlter Deal-Betrag (nur Info, keine Provisionsberechnung)
        isActive: v.boolean(),
    }).index("by_user", ["userId"]),

    creator_application: defineTable({
        name: v.string(),
        email: v.string(),
        phone: v.string(),
        social_accounts: v.optional(v.array(v.string())),
        app_id: v.id("apps"),
        video_link: v.optional(v.string()),
        description: v.optional(v.string()),
        country: v.string(),
        status: v.union(
            v.literal("pending"),
            v.literal("contacted"),
            v.literal("rejected"),
        ),
    }),

    affiliate_referral: defineTable({
        affiliateId: v.id("affiliate_profiles"),
        appId: v.id("apps"),
        appUserId: v.optional(v.string()),
        revenueCatUserId: v.optional(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("on_trial"),
            v.literal("converted"),
            v.literal("cancelled"),
            v.literal("refunded"),
        ),
        productId: v.optional(v.string()),
        subscriptionId: v.optional(v.string()),
        price: v.optional(v.number()),
        priceInPurchasedCurrency: v.optional(v.number()),
        currency: v.optional(v.string()),
        priceUsd: v.optional(v.number()),
        countryCode: v.optional(v.string()),
        store: v.optional(v.union(
            v.literal("APP_STORE"),
            v.literal("PLAY_STORE"),
            v.literal("AMAZON"),
            v.literal("STRIPE"),
            v.literal("MAC_APP_STORE"),
            v.literal("PROMOTIONAL"),
        )),
        takehomePercentage: v.optional(v.number()), // e.g. 0.85 — developer's share after store cut
        hasConverted: v.optional(v.boolean()),       // true = first payment received, false = refunded
        environment: v.optional(v.union(
            v.literal("PRODUCTION"),
            v.literal("SANDBOX"),
        )),
        trialStartedAt: v.optional(v.number()),
        convertedAt: v.optional(v.number()),
        cancelledAt: v.optional(v.number()),
        uncancelledAt: v.optional(v.number()),
        refundedAt: v.optional(v.number()),
        createdAt: v.number(),
    })
        .index("by_affiliate", ["affiliateId"])
        .index("by_rc_user", ["revenueCatUserId"]),

    // Link-Funnel: ein Lead pro (Web-Session, Affiliate, App).
    // viewed        → Landing-Page-Hit über /c/[code]
    // store_clicked → dieselbe Session ging danach Richtung App/Play Store
    // Keine IPs. Keine Verknüpfung zu affiliate_referral — Attribution über
    // den App-Store-Bruch hinweg nur aggregiert (pro Code).
    affiliate_lead: defineTable({
        affiliateId: v.id("affiliate_profiles"),
        appId: v.id("apps"),
        sessionId: v.string(),
        status: v.union(v.literal("viewed"), v.literal("store_clicked")),
        platform: v.optional(v.string()),   // "ios" | "android" | "desktop"
        referer: v.optional(v.string()),
        country: v.optional(v.string()),
        viewCount: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_affiliate", ["affiliateId"])
        .index("by_session", ["sessionId"]),

    user_invites: defineTable({
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        usedAt: v.optional(v.number()),
        token: v.optional(v.string()),
        affiliateCode: v.optional(v.string()),
        commissionType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
        commissionAmount: v.optional(v.number()),
        appIds: v.optional(v.array(v.id("apps"))),
        aiLabVisible: v.optional(v.boolean()),
    })
        .index("by_email", ["email"])
        .index("by_token", ["token"]),

    user_app_assignments: defineTable({
        userId: v.id("users"),
        appId: v.id("apps"),
    })
        .index("by_user", ["userId"])
        .index("by_app", ["appId"]),

    user_attachments: defineTable({
        userId: v.id("users"),
        fileName: v.string(),      // Original-Dateiname, z.B. "affiliate-vertrag-signiert.pdf"
        fileKey: v.string(),       // R2-Objekt-Key: user-attachments/{userId}/{timestamp}-{safeName}
        fileUrl: v.string(),       // Public-Download-URL (media.northbyte.studio)
        fileType: v.string(),      // MIME-Type
        fileSize: v.number(),      // Bytes
        uploadedAt: v.number(),
    }).index("by_user", ["userId"]),

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
        revenueCatAppStoreId: v.optional(v.string()),
        revenueCatPlayStoreId: v.optional(v.string()),
        postHogProjectId: v.optional(v.string()),
        postHogApiKeyEncrypted: v.optional(v.string()),
        postHogInstallEvent: v.optional(v.string()),
        postHogTrialEvent: v.optional(v.string()),
        termsOfUse: v.optional(v.string()),
        privacyPolicy: v.optional(v.string()),
    })
        .index("by_rc_appstore_id", ["revenueCatAppStoreId"])
        .index("by_rc_playstore_id", ["revenueCatPlayStoreId"]),

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
        platform: v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("x")),
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
        platform: v.optional(v.union(v.literal("tiktok"), v.literal("instagram"), v.literal("facebook"), v.literal("youtube"), v.literal("linkedin"), v.literal("x"))),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        videoUrl: v.optional(v.string()),
        mediaUrls: v.optional(v.array(v.string())),
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
        .index("by_status", ["status"])
        .index("by_account", ["accountId"]),

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

    ticket_counter: defineTable({
        value: v.number(),
    }),

    tickets: defineTable({
        ticketNumber: v.number(),
        appId: v.id("apps"),
        externalUserId: v.string(),
        email: v.optional(v.string()),
        title: v.string(),
        description: v.string(),
        status: v.union(v.literal("open"), v.literal("closed")),
        waitingOn: v.union(v.literal("support"), v.literal("user")),
        messageId: v.optional(v.string()),
        assets: v.optional(v.array(v.string())),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_app", ["appId"])
        .index("by_status", ["status"])
        .index("by_number", ["ticketNumber"]),

    ticket_messages: defineTable({
        ticketId: v.id("tickets"),
        authorId: v.optional(v.id("users")),   // set for support/admin replies
        externalAuthorId: v.optional(v.string()),       // set for app-user replies
        body: v.string(),
        assets: v.optional(v.array(v.string())),
        createdAt: v.number(),
    })
        .index("by_ticket", ["ticketId"]),
});
