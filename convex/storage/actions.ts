"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Upload files to Convex storage.
 * Accepts an array of file objects with base64 data and mime type.
 * Returns an array of storage IDs in the same order.
 */
export const uploadFiles = action({
    args: {
        files: v.array(
            v.object({
                data: v.string(), // Base64 encoded file data
                mimeType: v.string(), // MIME type (e.g., "image/png", "image/jpeg")
            })
        ),
    },
    handler: async (ctx, args) => {
        // Validate: maximum 2 files (logo + thumbnail)
        if (args.files.length > 2) {
            throw new Error("Maximum 2 files allowed (logo and thumbnail)");
        }

        // Validate: only image files
        const allowedMimeTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ];

        for (const file of args.files) {
            if (!allowedMimeTypes.includes(file.mimeType.toLowerCase())) {
                throw new Error(`Invalid file type: ${file.mimeType}. Only image files are allowed.`);
            }
        }

        const storageIds: Id<"_storage">[] = [];

        for (const file of args.files) {
            // Convert base64 to binary
            const base64Data = file.data.split(",")[1] || file.data; // Remove data URL prefix if present

            // Decode base64 to binary (works in both browser and Node.js)
            let binaryData: Uint8Array;
            if (typeof Buffer !== "undefined") {
                // Node.js environment - create a new ArrayBuffer to ensure type compatibility
                const buffer = Buffer.from(base64Data, "base64");
                const arrayBuffer = new ArrayBuffer(buffer.length);
                binaryData = new Uint8Array(arrayBuffer);
                binaryData.set(buffer);
            } else {
                // Browser environment
                binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
            }

            const bytes = Uint8Array.from(Buffer.from(base64Data, "base64"));
            const blob = new Blob([bytes], { type: file.mimeType });

            // Store in Convex storage
            const storageId = await ctx.storage.store(blob);
            storageIds.push(storageId);
        }

        return storageIds;
    },
});
