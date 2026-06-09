import { query } from "../_generated/server";
import { v } from "convex/values";

// Get all apps
export const getAll = query({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("apps").collect();
    },
});

// Returns apps the current user can access.
// Admins see all apps; support users see only their assigned apps.
export const getAccessibleApps = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const caller = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!caller) throw new Error("Unauthenticated");

        if (caller.type === "admin") {
            return await ctx.db.query("apps").collect();
        }

        const assignments = await ctx.db
            .query("user_app_assignments")
            .withIndex("by_user", (q) => q.eq("userId", caller._id))
            .collect();

        const apps = await Promise.all(assignments.map((a) => ctx.db.get(a.appId)));
        return apps.filter((a): a is NonNullable<typeof a> => a !== null);
    },
});

// Get all apps with thumbnail URLs for public display
// Only shows apps with status "live" or "coming soon"
export const getAllForPublic = query({
    args: {},
    handler: async (ctx) => {
        const allApps = await ctx.db.query("apps").collect();
        
        // Filter out archived apps
        const publicApps = allApps.filter(
            (app) => app.status === "live" || app.status === "coming soon"
        );
        
        return Promise.all(
            publicApps.map(async (app) => ({
                _id: app._id,
                name: app.name,
                slug: app.slug,
                tagline: app.tagline,
                description: app.description,
                status: app.status,
                logoUrl: app.logoStorageId
                    ? await ctx.storage.getUrl(app.logoStorageId)
                    : null,
                thumbnailUrl: app.thumbnailStorageId
                    ? await ctx.storage.getUrl(app.thumbnailStorageId)
                    : null,
            }))
        );
    },
});

// Get a single app by ID
export const getById = query({
    args: { appId: v.id("apps") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.appId);
    },
});

// Get apps by status
export const getByStatus = query({
    args: { status: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("apps")
            .filter((q) => q.eq(q.field("status"), args.status))
            .collect();
    },
});

// Get app by name (case-insensitive)
export const getByName = query({
    args: { name: v.string() },
    handler: async (ctx, args) => {
        const allApps = await ctx.db.query("apps").collect();
        return allApps.find(
            (app) => app.name.toLowerCase() === args.name.toLowerCase()
        ) || null;
    },
});

// Get app by slug
export const getBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const allApps = await ctx.db.query("apps").collect();
        return allApps.find(
            (app) => app.slug === args.slug
        ) || null;
    },
});

// Get app by slug with URLs for public display
export const getBySlugForPublic = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const allApps = await ctx.db.query("apps").collect();
        const app = allApps.find(
            (app) => app.slug === args.slug
        );
        
        if (!app) {
            return null;
        }
        
        return {
            _id: app._id,
            name: app.name,
            slug: app.slug,
            tagline: app.tagline,
            description: app.description,
            status: app.status,
            logoUrl: app.logoStorageId
                ? await ctx.storage.getUrl(app.logoStorageId)
                : null,
            thumbnailUrl: app.thumbnailStorageId
                ? await ctx.storage.getUrl(app.thumbnailStorageId)
                : null,
        };
    },
});
