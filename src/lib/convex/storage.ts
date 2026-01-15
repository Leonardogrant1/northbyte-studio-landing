"use client";

import { useMutation, useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Storage helper class for managing file uploads, retrieval, and deletion.
 * 
 * Usage:
 * ```tsx
 * const storage = useStorage();
 * 
 * // Upload a file
 * const storageId = await storage.uploadFile(file);
 * 
 * // Get file URL
 * const url = await storage.getFileUrl(storageId);
 * 
 * // Delete a file
 * await storage.deleteFile(storageId);
 * ```
 */
export class StorageHelper {
    private generateUploadUrl: () => Promise<string>;
    private getUrl: (args: { storageId: Id<"_storage"> }) => Promise<string | null>;
    private deleteFileMutation: (args: { storageId: Id<"_storage"> }) => Promise<{ success: boolean }>;

    constructor(
        generateUploadUrl: () => Promise<string>,
        getUrl: (args: { storageId: Id<"_storage"> }) => Promise<string | null>,
        deleteFileMutation: (args: { storageId: Id<"_storage"> }) => Promise<{ success: boolean }>
    ) {
        this.generateUploadUrl = generateUploadUrl;
        this.getUrl = getUrl;
        this.deleteFileMutation = deleteFileMutation;
    }

    /**
     * Upload a file to Convex storage.
     * This performs a 3-step process:
     * 1. Generate an upload URL
     * 2. POST the file to the URL
     * 3. Return the storage ID
     * 
     * @param file - The file to upload
     * @returns The storage ID of the uploaded file
     * @throws Error if upload fails
     */
    async uploadFile(file: File): Promise<Id<"_storage">> {
        try {
            // Step 1: Get a short-lived upload URL
            const postUrl = await this.generateUploadUrl();

            // Step 2: POST the file to the URL
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });

            if (!result.ok) {
                throw new Error(`Upload failed: ${result.statusText}`);
            }

            const { storageId } = await result.json();
            return storageId as Id<"_storage">;
        } catch (error) {
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get a URL for a stored file.
     * 
     * @param storageId - The storage ID of the file
     * @returns The URL of the file, or null if not found
     */
    async getFileUrl(storageId: Id<"_storage">): Promise<string | null> {
        return await this.getUrl({ storageId });
    }

    /**
     * Delete a file from storage.
     * 
     * @param storageId - The storage ID of the file to delete
     * @returns Promise that resolves when deletion is complete
     */
    async deleteFile(storageId: Id<"_storage">): Promise<void> {
        await this.deleteFileMutation({ storageId });
    }
}

/**
 * React hook to get a StorageHelper instance.
 * Use this in React components to interact with Convex storage.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const storage = useStorage();
 *   
 *   const handleUpload = async (file: File) => {
 *     const storageId = await storage.uploadFile(file);
 *     console.log('Uploaded:', storageId);
 *   };
 *   
 *   return <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />;
 * }
 * ```
 */
export function useStorage(): StorageHelper {
    const convex = useConvex();
    const generateUploadUrl = useMutation(api.storage.mutations.generateUploadUrl);
    const deleteFileMutation = useMutation(api.storage.mutations.deleteFile);

    // Use the convex client to query imperatively
    const getUrl = async (args: { storageId: Id<"_storage"> }): Promise<string | null> => {
        return await convex.query(api.storage.queries.getUrl, args);
    };

    return new StorageHelper(
        generateUploadUrl,
        getUrl,
        deleteFileMutation
    );
}

/**
 * Create a StorageHelper instance using the Convex client directly.
 * Use this outside of React components or when you need more control.
 * 
 * @param client - The ConvexReactClient instance (or any object with mutation/query methods)
 * @returns A StorageHelper instance
 */
export function createStorageHelper(client: { 
    mutation: (api: any, args?: any) => Promise<any>;
    query: (api: any, args?: any) => Promise<any>;
}): StorageHelper {
    return new StorageHelper(
        () => client.mutation(api.storage.mutations.generateUploadUrl),
        (args) => client.query(api.storage.queries.getUrl, args),
        (args) => client.mutation(api.storage.mutations.deleteFile, args)
    );
}
