"use client";

import { useParams } from "next/navigation";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook to get the current app ID from the URL params
 * Used in admin routes like /admin/[appId]/...
 */
export function useAppId(): Id<"apps"> | null {
    const params = useParams();
    const appId = params?.appId as string | undefined;

    return appId ? (appId as Id<"apps">) : null;
}
