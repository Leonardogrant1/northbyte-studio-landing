import { auth } from "@clerk/nextjs/server";

/**
 * Check if the current user is an admin (has @northbyte.studio email)
 */
export async function isAdmin(): Promise<boolean> {
    const { userId } = await auth();

    if (!userId) {
        return false;
    }

    // Get user from Clerk
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    const email = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;

    return email?.endsWith("@northbyte.studio") ?? false;
}

// Re-export client-safe utilities
export { isNorthByteEmail } from "./auth-utils";

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
    const { userId } = await auth();

    if (!userId) {
        return null;
    }

    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    return await client.users.getUser(userId);
}
