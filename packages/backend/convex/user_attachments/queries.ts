import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
}

// Admin-only — alle Attachments eines Users, neueste zuerst.
export const getByUserId = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const attachments = await ctx.db
            .query("user_attachments")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        return attachments.sort((a, b) => b.uploadedAt - a.uploadedAt);
    },
});

// Admin-only — Anzahl Attachments je User, für die Badges in der User-Tabelle.
export const getCountsByUser = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const all = await ctx.db.query("user_attachments").collect();
        const counts: Record<string, number> = {};
        for (const attachment of all) {
            counts[attachment.userId] = (counts[attachment.userId] ?? 0) + 1;
        }
        return counts;
    },
});
