import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: MutationCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
}

// Admin-only — wird NACH erfolgreichem R2-Upload aufgerufen (kein verwaister DB-Eintrag).
export const create = mutation({
    args: {
        userId: v.id("users"),
        fileName: v.string(),
        fileKey: v.string(),
        fileUrl: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        return await ctx.db.insert("user_attachments", {
            ...args,
            uploadedAt: Date.now(),
        });
    },
});

// Admin-only — löscht nur den DB-Eintrag; das R2-Objekt entfernt der Client
// über /api/r2/delete (verwaiste R2-Objekte sind akzeptabel, umgekehrt nicht).
export const remove = mutation({
    args: { attachmentId: v.id("user_attachments") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment) throw new Error("Attachment not found");

        await ctx.db.delete(args.attachmentId);
        return { fileKey: attachment.fileKey };
    },
});
