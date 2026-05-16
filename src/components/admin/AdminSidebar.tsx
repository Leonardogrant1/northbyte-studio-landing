"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { BarChart2, Bug, Lightbulb, AppWindow, Image, FlaskConical, FileEdit, Users, AtSign, Bot, LayoutList, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function AdminSidebarInner() {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();
    const user = useCurrentUser();

    const appIdFromRoute = params?.appId as string | undefined;
    const appIdFromQuery = searchParams.get("app");
    const currentAppId = appIdFromRoute || appIdFromQuery;
    const appQuery = currentAppId ? `?app=${currentAppId}` : "";

    const isAdmin = user?.type === "admin";
    const isAffiliate = user?.type === "affiliate";

    const allTabs = [
        {
            label: "Analytics",
            icon: BarChart2,
            href: `/admin${appQuery}`,
            isActive: pathname === "/admin",
            adminOnly: true,
            affiliateOnly: false,
        },
        {
            label: "Bugs",
            icon: Bug,
            href: `/admin/bugs${appQuery}`,
            isActive: pathname === "/admin/bugs",
            adminOnly: true,
        },
        {
            label: "Features",
            icon: Lightbulb,
            href: `/admin/features${appQuery}`,
            isActive: pathname === "/admin/features",
            adminOnly: true,
        },
        {
            label: "Apps",
            icon: AppWindow,
            href: `/admin/apps${appQuery}`,
            isActive: pathname === "/admin/apps",
            adminOnly: true,
        },
        {
            label: "Media",
            icon: Image,
            href: "/admin/media",
            isActive: pathname === "/admin/media",
            adminOnly: false,
            affiliateOnly: false,
        },
        {
            label: "AI-Lab",
            icon: FlaskConical,
            href: "/admin/ai-lab",
            isActive: pathname === "/admin/ai-lab",
            adminOnly: false,
            affiliateOnly: false,
        },
        {
            label: "Post Content",
            icon: FileEdit,
            href: "/admin/post-content",
            isActive: pathname === "/admin/post-content",
            adminOnly: false,
            affiliateOnly: false,
        },
        {
            label: "Contents",
            icon: LayoutList,
            href: "/admin/contents",
            isActive: pathname === "/admin/contents",
            adminOnly: false,
            affiliateOnly: false,
        },
        {
            label: "Social Accounts",
            icon: AtSign,
            href: "/admin/social-accounts",
            isActive: pathname === "/admin/social-accounts",
            adminOnly: true,
        },
        {
            label: "AI Avatars",
            icon: Bot,
            href: "/admin/ai-avatars",
            isActive: pathname === "/admin/ai-avatars",
            adminOnly: true,
        },
        {
            label: "User & Roles",
            icon: Users,
            href: "/admin/users",
            isActive: pathname === "/admin/users",
            adminOnly: true,
            affiliateOnly: false,
        },
        {
            label: "Dashboard",
            icon: TrendingUp,
            href: "/admin/affiliate",
            isActive: pathname === "/admin/affiliate",
            adminOnly: false,
            affiliateOnly: true,
        },
    ];

    const tabs = allTabs.filter((tab) => {
        if (user === undefined || user === null) return false;
        if (isAffiliate) return tab.affiliateOnly === true;
        return !tab.adminOnly || isAdmin;
    });

    return (
        <aside className="w-56 shrink-0 border-r border-border p-4">
            <nav className="space-y-1">
                {tabs.map(({ label, icon: Icon, href, isActive }) => (
                    <Link
                        key={label}
                        href={href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            isActive
                                ? "bg-accent/10 text-accent"
                                : "text-secondary hover:bg-surface2 hover:text-primary"
                        }`}
                    >
                        <Icon size={18} />
                        <span className="font-medium">{label}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}

export function AdminSidebar() {
    return (
        <Suspense fallback={<aside className="w-56 shrink-0 border-r border-border" />}>
            <AdminSidebarInner />
        </Suspense>
    );
}
