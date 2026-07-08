"use client";

import { Suspense, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type FilterTab = "all" | "waiting_support" | "waiting_user" | "closed";

const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",             label: "Alle" },
    { key: "waiting_support", label: "Warten auf uns" },
    { key: "waiting_user",    label: "Warten auf User" },
    { key: "closed",          label: "Geschlossen" },
];

function SupportContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app") as Id<"apps"> | null;

    const currentUser = useCurrentUser();
    const isAllowed = currentUser?.type === "admin" || currentUser?.type === "support";
    const tickets = useQuery(api.tickets.queries.getForSupportUser, isAllowed ? {} : "skip");
    const apps = useQuery(api.apps.queries.getAccessibleApps, isAllowed ? {} : "skip");

    const [activeTab, setActiveTab] = useState<FilterTab>("all");

    // Open ticket count per app, derived from already-fetched tickets
    const openCountByApp = (tickets ?? []).reduce<Record<string, number>>((acc, t) => {
        if (t.status === "open") acc[t.appId] = (acc[t.appId] ?? 0) + 1;
        return acc;
    }, {});

    const filtered = (tickets ?? []).filter((t) => {
        if (selectedAppId && t.appId !== selectedAppId) return false;
        if (activeTab === "waiting_support") return t.status === "open" && t.waitingOn === "support";
        if (activeTab === "waiting_user")    return t.status === "open" && t.waitingOn === "user";
        if (activeTab === "closed")          return t.status === "closed";
        return true;
    });

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-1">Support</h1>
                <p className="text-secondary">Ticket-Anfragen verwalten.</p>
            </div>

            {/* App selector */}
            {apps && apps.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                    {apps.map((app) => (
                        <button
                            key={app._id}
                            onClick={() =>
                                router.push(
                                    selectedAppId === app._id
                                        ? "/admin/support"
                                        : `/admin/support?app=${app._id}`
                                )
                            }
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                selectedAppId === app._id
                                    ? "bg-accent/10 border-accent text-accent"
                                    : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                            }`}
                        >
                            {app.name}
                            {(openCountByApp[app._id] ?? 0) > 0 && (
                                <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                                    selectedAppId === app._id
                                        ? "bg-accent/20 text-accent"
                                        : "bg-orange-500/20 text-orange-400"
                                }`}>
                                    {openCountByApp[app._id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1 border-b border-border">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? "border-accent text-accent"
                                : "border-transparent text-secondary hover:text-primary"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {tickets === undefined ? (
                <div className="flex items-center gap-2 text-secondary text-sm">
                    <Loader2 size={14} className="animate-spin" /> Wird geladen…
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-secondary text-sm">Keine Tickets vorhanden.</p>
            ) : (
                <div className="border border-border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-surface2/30">
                                <th className="text-left px-4 py-3 text-secondary font-medium w-16">#</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Titel</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">App</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Datum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((ticket) => (
                                <tr
                                    key={ticket._id}
                                    onClick={() => router.push(`/admin/support/${ticket._id}`)}
                                    className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3 text-secondary font-mono text-xs">#{ticket.ticketNumber}</td>
                                    <td className="px-4 py-3 text-primary font-medium">{ticket.title}</td>
                                    <td className="px-4 py-3 text-secondary">{ticket.appName}</td>
                                    <td className="px-4 py-3">
                                        {ticket.status === "closed" ? (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-border/50 text-secondary">
                                                Geschlossen
                                            </span>
                                        ) : ticket.waitingOn === "support" ? (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                                                Warten auf uns
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                                                Warten auf User
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-secondary">{formatDate(ticket.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function SupportPage() {
    return (
        <Suspense fallback={<div className="text-secondary text-sm">Wird geladen…</div>}>
            <SupportContent />
        </Suspense>
    );
}
