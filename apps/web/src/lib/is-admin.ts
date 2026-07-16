import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

/**
 * Server-side check whether the current Clerk session belongs to an admin user.
 * Returns false when there is no session, the token cannot be issued, or the
 * Convex user is missing/not an admin.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken({ template: "convex" });
    } catch {
        return false;
    }
    if (!token) return false;

    try {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);
        const user = await convex.query(api.users.queries.getCurrentUser, {});
        return user?.type === "admin";
    } catch {
        return false;
    }
}
