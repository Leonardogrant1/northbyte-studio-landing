"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Routes that only admins can access (matched as prefix)
const ADMIN_ONLY_PREFIXES = ["/admin/bugs", "/admin/features", "/admin/apps", "/admin/users", "/admin/social-accounts", "/admin/ai-avatars"];
// /admin root is an exact match to avoid false positives on /admin/media, /admin/ai-lab, etc.
const ADMIN_ONLY_EXACT = ["/admin"];

function isAdminOnlyRoute(pathname: string): boolean {
    if (ADMIN_ONLY_EXACT.includes(pathname)) return true;
    return ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

// Affiliates can only access their own dashboard
function isAffiliateAllowedRoute(pathname: string): boolean {
    return pathname === "/admin/affiliate" || pathname.startsWith("/admin/affiliate/");
}

// Support users can only access the support section (admins can too)
function isSupportAllowedRoute(pathname: string): boolean {
    return pathname === "/admin/support" || pathname.startsWith("/admin/support/");
}

interface RoleGuardProps {
    children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useCurrentUser();

    useEffect(() => {
        // Wait until user is loaded
        if (user === undefined) return;

        // If no user in DB yet (rare race condition), do nothing — layout already checked Clerk auth
        if (user === null) return;

        if (user.type === "creator" && isAdminOnlyRoute(pathname)) {
            router.replace("/admin/creator-dashboard");
        }

        if (user.type === "affiliate" && !isAffiliateAllowedRoute(pathname)) {
            router.replace("/admin/affiliate");
        }

        if (user.type === "support" && !isSupportAllowedRoute(pathname)) {
            router.replace("/admin/support");
        }
    }, [user, pathname, router]);

    // Show nothing while redirecting to avoid flash
    if (user?.type === "creator" && isAdminOnlyRoute(pathname)) return null;
    if (user?.type === "affiliate" && !isAffiliateAllowedRoute(pathname)) return null;
    if (user?.type === "support" && !isSupportAllowedRoute(pathname)) return null;

    return <>{children}</>;
}
