"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { BarChart2, Bug, Lightbulb, AppWindow, Image, FlaskConical, FileEdit, Users, AtSign, Bot, LayoutList, TrendingUp, LayoutDashboard, Headphones, UserCheck, Percent } from "lucide-react";
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
    const isCreator = user?.type === "creator";
    const isSupport = user?.type === "support";

    const allTabs = [
        {
            label: "Analytics",
            icon: BarChart2,
            href: `/admin${appQuery}`,
            isActive: pathname === "/admin",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Bugs",
            icon: Bug,
            href: `/admin/bugs${appQuery}`,
            isActive: pathname === "/admin/bugs",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Features",
            icon: Lightbulb,
            href: `/admin/features${appQuery}`,
            isActive: pathname === "/admin/features",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Apps",
            icon: AppWindow,
            href: `/admin/apps${appQuery}`,
            isActive: pathname === "/admin/apps",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Applications",
            icon: UserCheck,
            href: `/admin/creator-applications${appQuery}`,
            isActive: pathname === "/admin/creator-applications",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Media",
            icon: Image,
            href: "/admin/media",
            isActive: pathname === "/admin/media",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "AI-Lab",
            icon: FlaskConical,
            href: "/admin/ai-lab",
            isActive: pathname === "/admin/ai-lab",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Post Content",
            icon: FileEdit,
            href: "/admin/post-content",
            isActive: pathname === "/admin/post-content",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Contents",
            icon: LayoutList,
            href: "/admin/contents",
            isActive: pathname === "/admin/contents",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Social Accounts",
            icon: AtSign,
            href: "/admin/social-accounts",
            isActive: pathname === "/admin/social-accounts",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "AI Avatars",
            icon: Bot,
            href: "/admin/ai-avatars",
            isActive: pathname === "/admin/ai-avatars",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "User & Roles",
            icon: Users,
            href: "/admin/users",
            isActive: pathname === "/admin/users",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Affiliates",
            icon: Percent,
            href: "/admin/affiliates",
            isActive: pathname === "/admin/affiliates",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Dashboard",
            icon: TrendingUp,
            href: "/admin/affiliate",
            isActive: pathname === "/admin/affiliate",
            adminOnly: false,
            affiliateOnly: true,
            creatorOnly: false,
        },
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/admin/creator-dashboard",
            isActive: pathname === "/admin/creator-dashboard",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: true,
        },
        {
            label: "Support",
            icon: Headphones,
            href: "/admin/support",
            isActive: pathname === "/admin/support",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
    ];

    const tabs = allTabs.filter((tab) => {
        if (user === undefined || user === null) return false;
        if (isAffiliate) return tab.affiliateOnly === true;
        if (isCreator) {
            if (tab.href === "/admin/support") return false;
            if (tab.href === "/admin/ai-lab" && user?.aiLabVisible !== true) return false;
            return !tab.adminOnly && !tab.affiliateOnly;
        }
        if (isSupport) return tab.href === "/admin/support";
        if (isAdmin) return !tab.affiliateOnly && !tab.creatorOnly;
        return false;
    });

    return (
        <aside className="w-56 shrink-0 border-r border-border p-4">
            <nav className="space-y-1">
                {tabs.map(({ label, icon: Icon, href, isActive }) => (
                    <Link
                        key={href}
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
