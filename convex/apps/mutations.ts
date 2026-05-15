import { mutation } from "../_generated/server.js";
import { v } from "convex/values";

// Create a new app
export const create = mutation({
    args: {
        name: v.string(),
        domain: v.string(),
        tagline: v.string(),
        description: v.string(),
        status: v.string(),
        slug: v.string(),
        logoStorageId: v.optional(v.id("_storage")),
        thumbnailStorageId: v.optional(v.id("_storage")),
        termsOfUse: v.optional(v.string()),
        privacyPolicy: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Validate slug uniqueness if provided
        if (args.slug) {
            const existingApp = await ctx.db
                .query("apps")
                .filter((q) => q.eq(q.field("slug"), args.slug))
                .first();

            if (existingApp) {
                throw new Error(`Slug "${args.slug}" is already taken`);
            }
        }

        return await ctx.db.insert("apps", {
            name: args.name,
            domain: args.domain,
            tagline: args.tagline,
            description: args.description,
            status: args.status,
            slug: args.slug,
            logoStorageId: args.logoStorageId,
            thumbnailStorageId: args.thumbnailStorageId,
            ...(args.termsOfUse ? { termsOfUse: args.termsOfUse } : {}),
            ...(args.privacyPolicy ? { privacyPolicy: args.privacyPolicy } : {}),
        });
    },
});

// Update an existing app
export const update = mutation({
    args: {
        appId: v.id("apps"),
        name: v.optional(v.string()),
        domain: v.optional(v.string()),
        tagline: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        slug: v.optional(v.string()),
        logoStorageId: v.optional(v.id("_storage")),
        thumbnailStorageId: v.optional(v.id("_storage")),
        revenueCatProjectId:       v.optional(v.string()),
        revenueCatApiKeyEncrypted: v.optional(v.string()),
        revenueCatAppStoreId:      v.optional(v.string()),
        revenueCatPlayStoreId:     v.optional(v.string()),
        postHogProjectId:          v.optional(v.string()),
        postHogApiKeyEncrypted:    v.optional(v.string()),
        postHogInstallEvent:       v.optional(v.string()),
        postHogTrialEvent:         v.optional(v.string()),
        termsOfUse:                v.optional(v.string()),
        privacyPolicy:             v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Validate slug uniqueness if provided and changed
        if (args.slug !== undefined) {
            const existingApp = await ctx.db
                .query("apps")
                .filter((q) => q.eq(q.field("slug"), args.slug))
                .first();

            if (existingApp && existingApp._id !== args.appId) {
                throw new Error(`Slug "${args.slug}" is already taken`);
            }
        }

        const { appId, ...updates } = args;

        // Build patch: skip undefined, convert "" to undefined for legal text fields (removes the field from the document)
        const patchData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value === undefined) continue;
            if ((key === "termsOfUse" || key === "privacyPolicy") && value === "") {
                patchData[key] = undefined;
            } else {
                patchData[key] = value;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.db.patch(appId, patchData as any);
        return appId;
    },
});

// Delete an app
export const remove = mutation({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.appId);
    },
});
