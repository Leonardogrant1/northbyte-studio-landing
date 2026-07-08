import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get a URL for a stored file.
 * Returns null if the file doesn't exist.
 */
export const getUrl = query({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});
