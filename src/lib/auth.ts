import { auth } from "@clerk/nextjs/server";

/**
 * Returns the Clerk userId if authenticated, null otherwise.
 * Used server-side to gate the dashboard layout.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
    const { userId } = await auth();
    return userId ?? null;
}
