"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CheckCircle2, Clock, Send, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <div className="bg-surface2/50 border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-secondary font-medium">{label}</span>
                <div className={`p-2 rounded-xl ${color}`}>
                    <Icon size={16} />
                </div>
            </div>
            <p className="text-3xl font-bold text-primary">{value}</p>
        </div>
    );
}

export default function CreatorDashboardPage() {
    const { isAuthenticated } = useConvexAuth();
    const user = useCurrentUser();
    const stats = useQuery(api.posts.queries.getMyPostStats, isAuthenticated ? {} : "skip");
    const recentPosts = useQuery(api.posts.queries.getRecent, isAuthenticated ? { limit: 5 } : "skip");

    if (user === undefined || stats === undefined) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const greeting = user?.name ? `Hi, ${user.name}` : "Hi";

    return (
        <div className="max-w-4xl space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-1">{greeting}</h1>
                <p className="text-secondary">Hier ist eine Übersicht deiner Inhalte.</p>
            </div>

            {/* Stat cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Ready to Post"
                    value={stats?.ready_to_post ?? 0}
                    icon={CheckCircle2}
                    color="bg-emerald-500/10 text-emerald-400"
                />
                <StatCard
                    label="Scheduled"
                    value={stats?.scheduled ?? 0}
                    icon={Clock}
                    color="bg-blue-500/10 text-blue-400"
                />
                <StatCard
                    label="Posted"
                    value={stats?.posted ?? 0}
                    icon={Send}
                    color="bg-purple-500/10 text-purple-400"
                />
                <StatCard
                    label="Failed"
                    value={stats?.failed ?? 0}
                    icon={XCircle}
                    color="bg-red-500/10 text-red-400"
                />
            </section>

            {/* Recent posts */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Letzte Inhalte</h2>
                        <p className="text-secondary text-sm mt-0.5">Deine zuletzt erstellten Posts</p>
                    </div>
                    <Link
                        href="/admin/contents"
                        className="flex items-center gap-1.5 text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Alle anzeigen
                        <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
                    {recentPosts === undefined ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : recentPosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-secondary">
                            <p className="text-sm">Noch keine Inhalte erstellt.</p>
                            <Link
                                href="/admin/post-content"
                                className="text-sm text-accent hover:underline"
                            >
                                Ersten Post erstellen
                            </Link>
                        </div>
                    ) : (
                        recentPosts.map((post, idx) => {
                            const PLATFORM_EMOJI: Record<string, string> = { tiktok: "🎵", instagram: "📸" };
                            const STATUS_LABEL: Record<string, string> = {
                                ready_to_post: "Ready",
                                scheduled: "Scheduled",
                                posted: "Posted",
                                failed: "Failed",
                            };
                            const STATUS_COLOR: Record<string, string> = {
                                ready_to_post: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                                scheduled: "text-blue-400 bg-blue-400/10 border-blue-400/20",
                                posted: "text-purple-400 bg-purple-400/10 border-purple-400/20",
                                failed: "text-red-400 bg-red-400/10 border-red-400/20",
                            };
                            const platformEmoji = post.account
                                ? PLATFORM_EMOJI[post.account.platform] ?? "🌐"
                                : "🌐";

                            return (
                                <div
                                    key={post._id}
                                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface2/80 ${
                                        idx !== recentPosts.length - 1 ? "border-b border-border/50" : ""
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-primary truncate">{post.title}</p>
                                        {post.account && (
                                            <p className="text-xs text-secondary mt-0.5">
                                                {platformEmoji} @{post.account.username}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[post.status] ?? "text-secondary bg-surface border-border"}`}
                                    >
                                        {STATUS_LABEL[post.status] ?? post.status}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            {/* Coming soon footer */}
            <p className="text-xs text-secondary/50 text-center pb-4">
                Mehr Analytics folgen bald.
            </p>
        </div>
    );
}
