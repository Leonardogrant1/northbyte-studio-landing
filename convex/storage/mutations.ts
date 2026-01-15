import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Generate an upload URL for file uploads.
 * The URL expires in 1 hour.
 */
export const generateUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        return await ctx.storage.generateUploadUrl();
    },
});

/**
 * Delete a file from storage.
 */
export const deleteFile = mutation({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        await ctx.storage.delete(args.storageId);
        return { success: true };
    },
});
