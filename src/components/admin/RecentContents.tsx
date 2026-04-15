"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRight, CheckCircle2, Clock, Send, XCircle, FileText } from "lucide-react";
import Link from "next/link";

// ─── Status display helpers ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    string,
    { label: string; icon: React.ElementType; className: string }
> = {
    ready_to_post: {
        label: "Ready",
        icon: CheckCircle2,
        className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    },
    scheduled: {
        label: "Scheduled",
        icon: Clock,
        className: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    },
    posted: {
        label: "Posted",
        icon: Send,
        className: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    },
    failed: {
        label: "Failed",
        icon: XCircle,
        className: "text-red-400 bg-red-400/10 border-red-400/20",
    },
};

const PLATFORM_EMOJI: Record<string, string> = {
    tiktok: "🎵",
    instagram: "📸",
};

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-surface2" />
            <div className="flex-1 space-y-1.5 min-w-0">
                <div className="h-3.5 rounded bg-surface2 w-2/5" />
                <div className="h-3 rounded bg-surface2 w-1/4" />
            </div>
            <div className="h-6 w-20 rounded-full bg-surface2" />
            <div className="h-3 w-12 rounded bg-surface2" />
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecentContents({ showAll = false }: { showAll?: boolean }) {
    const { isAuthenticated } = useConvexAuth();
    const posts = useQuery(
        api.posts.queries.getRecent,
        isAuthenticated ? (showAll ? {} : { limit: 20 }) : "skip"
    );

    return (
        <section className="mt-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold">Contents</h2>
                    <p className="text-secondary text-sm mt-0.5">Zuletzt erstellte Inhalte</p>
                </div>
                {!showAll && (
                    <Link
                        href="/admin/contents"
                        className="flex items-center gap-1.5 text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Alle anzeigen
                        <ArrowRight size={14} />
                    </Link>
                )}
            </div>

            {/* Table card */}
            <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-border">
                    <span className="text-xs font-semibold uppercase tracking-wide text-secondary">Titel</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Account</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Status</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Erstellt</span>
                </div>

                {/* Rows */}
                {posts === undefined ? (
                    // Loading
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : posts.length === 0 ? (
                    // Empty state
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-secondary">
                        <FileText size={32} strokeWidth={1.5} />
                        <p className="text-sm">Noch keine Contents erstellt.</p>
                    </div>
                ) : (
                    posts.map((post, idx) => {
                        const cfg = STATUS_CONFIG[post.status] ?? {
                            label: post.status,
                            icon: Clock,
                            className: "text-secondary bg-surface border-border",
                        };
                        const StatusIcon = cfg.icon;
                        const platformEmoji = post.account
                            ? PLATFORM_EMOJI[post.account.platform] ?? "🌐"
                            : "🌐";

                        return (
                            <div
                                key={post._id}
                                className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors hover:bg-surface2/80 ${
                                    idx !== posts.length - 1 ? "border-b border-border/50" : ""
                                }`}
                            >
                                {/* Title */}
                                <div className="min-w-0">
                                    <p className="font-medium text-sm text-primary truncate">{post.title}</p>
                                    {post.description && (
                                        <p className="text-xs text-secondary truncate mt-0.5">{post.description}</p>
                                    )}
                                </div>

                                {/* Account */}
                                <div className="text-right">
                                    {post.account ? (
                                        <span className="text-xs text-secondary whitespace-nowrap">
                                            {platformEmoji}{" "}
                                            <span className="text-primary font-medium">
                                                @{post.account.username}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="text-xs text-secondary/50">—</span>
                                    )}
                                </div>

                                {/* Status badge */}
                                <div className="flex justify-end">
                                    <span
                                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.className}`}
                                    >
                                        <StatusIcon size={11} />
                                        {cfg.label}
                                    </span>
                                </div>

                                {/* Time */}
                                <div className="text-right">
                                    <span className="text-xs text-secondary whitespace-nowrap">
                                        {timeAgo(post.createdAt)}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}
