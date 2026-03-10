"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { BarChart2, Bug, Lightbulb, AppWindow } from "lucide-react";
import { Suspense } from "react";

function AdminSidebarInner() {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();

    // appId from URL segment (e.g. /admin/[appId]/settings)
    const appIdFromRoute = params?.appId as string | undefined;
    // appId from query param (e.g. /admin/bugs?app=...)
    const appIdFromQuery = searchParams.get("app");

    const currentAppId = appIdFromRoute || appIdFromQuery;

    // Build links — preserve the currently selected app across tabs
    const appQuery = currentAppId ? `?app=${currentAppId}` : "";

    const tabs = [
        {
            label: "Analytics",
            icon: BarChart2,
            href: `/admin${appQuery}`,
            isActive: pathname === "/admin",
            disabled: false,
        },
        {
            label: "Bugs",
            icon: Bug,
            href: `/admin/bugs${appQuery}`,
            isActive: pathname === "/admin/bugs",
            disabled: false,
        },
        {
            label: "Features",
            icon: Lightbulb,
            href: `/admin/features${appQuery}`,
            isActive: pathname === "/admin/features",
            disabled: false,
        },
        {
            label: "Apps",
            icon: AppWindow,
            href: `/admin/apps${appQuery}`,
            isActive: pathname === "/admin/apps",
            disabled: false,
        },
    ];

    return (
        <aside className="w-56 shrink-0 border-r border-border p-4">
            <nav className="space-y-1">
                {tabs.map(({ label, icon: Icon, href, isActive, disabled }) =>
                    disabled || !href ? (
                        <div
                            key={label}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-secondary/30 cursor-not-allowed select-none"
                        >
                            <Icon size={18} />
                            <span className="font-medium">{label}</span>
                        </div>
                    ) : (
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
                    )
                )}
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
