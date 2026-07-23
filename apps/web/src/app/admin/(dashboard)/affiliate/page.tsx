"use client";

import { useState, useMemo } from "react";
import { Copy, Check, DollarSign, Users, TrendingUp, RefreshCw, XCircle, Eye, MousePointerClick } from "lucide-react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToStartOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function isoToEndOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
    sub,
}: {
    label: string;
    value: string;
    icon: React.ElementType;
    color: string;
    sub?: string;
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
            {sub && <p className="text-xs text-secondary/70">{sub}</p>}
        </div>
    );
}

export default function AffiliateDashboardPage() {
    const { isAuthenticated } = useConvexAuth();
    const user = useCurrentUser();
    const profile = useQuery(api.affiliate_profiles.queries.getMyProfile, isAuthenticated ? {} : "skip");
    const isFlat = profile?.commissionType === "flat";
    const [copied, setCopied] = useState(false);

    const today = todayIso();
    const defaultFrom = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(today);
    const [environment, setEnvironment] = useState<"PRODUCTION" | "SANDBOX">("PRODUCTION");

    const fromMs = useMemo(() => isoToStartOfDayMs(from), [from]);
    const toMs = useMemo(() => isoToEndOfDayMs(to), [to]);

    const stats = useQuery(api.affiliate_profiles.queries.getMyStats, isAuthenticated && !isFlat ? { fromMs, toMs, environment } : "skip");

    const affiliateCode = profile?.affiliateCode ?? null;

    if (user === undefined || profile === undefined) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleCopy = () => {
        if (!affiliateCode) return;
        navigator.clipboard.writeText(affiliateCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const greeting = user?.name ? `Hey, ${user.name}` : "Hey";

    return (
        <div className="max-w-4xl space-y-10">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold mb-1">{greeting} 👋</h1>
                    <p className="text-secondary">Dein Affiliate-Dashboard</p>
                </div>
                {!isFlat && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setEnvironment(e => e === "PRODUCTION" ? "SANDBOX" : "PRODUCTION")}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${environment === "SANDBOX"
                                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                                : "border-border text-secondary hover:border-accent/50"
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${environment === "SANDBOX" ? "bg-yellow-400" : "bg-green-400"}`} />
                            {environment === "SANDBOX" ? "Sandbox" : "Production"}
                        </button>
                        <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
                    </div>
                )}
            </div>

            {/* Promo Code + Commission */}
            <section className="bg-surface2/50 border border-border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                    <p className="text-sm text-secondary font-medium mb-3">Dein Promo-Code</p>
                    {affiliateCode ? (
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-mono font-bold text-primary tracking-widest">
                                {affiliateCode}
                            </span>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium rounded-lg transition-all"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? "Kopiert!" : "Kopieren"}
                            </button>
                        </div>
                    ) : (
                        <p className="text-secondary text-sm">Kein Affiliate-Code zugewiesen.</p>
                    )}
                </div>

                {profile && (
                    <div className="sm:border-l sm:border-border sm:pl-6">
                        <p className="text-sm text-secondary font-medium mb-3">
                            {profile.commissionType === "flat" ? "Dein Deal" : "Deine Provision"}
                        </p>
                        <p className="text-2xl font-bold text-primary">
                            {profile.commissionType === "percentage"
                                ? `${profile.commissionAmount}%`
                                : `$${profile.commissionAmount}`}
                        </p>
                        <p className="text-xs text-secondary/70 mt-1">
                            {profile.commissionType === "percentage"
                                ? "Pro Conversion"
                                : profile.commissionType === "fixed"
                                ? "Fester Betrag"
                                : "Pauschale"}
                        </p>
                    </div>
                )}
            </section>

            {/* Stats Grid */}
            {!isFlat && (
                <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <StatCard
                        label="Verdient"
                        value={stats && stats.earned !== null ? `$${stats.earned.toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : "—"}
                        icon={DollarSign}
                        color="bg-green-500/10 text-green-400"
                        sub="Gesamte Provisionen"
                    />
                    <StatCard
                        label="Link-Views"
                        value={stats ? stats.linkViews.toString() : "—"}
                        icon={Eye}
                        color="bg-sky-500/10 text-sky-400"
                        sub="Aufrufe deines Links"
                    />
                    <StatCard
                        label="Store-Klicks"
                        value={stats ? stats.storeClicks.toString() : "—"}
                        icon={MousePointerClick}
                        color="bg-teal-500/10 text-teal-400"
                        sub="Weiter zum App Store"
                    />
                    <StatCard
                        label="Click-Through-Rate"
                        value={stats ? `${stats.clickThroughRate.toFixed(1)}%` : "—"}
                        icon={TrendingUp}
                        color="bg-cyan-500/10 text-cyan-400"
                        sub="Views → Store-Klicks"
                    />
                    <StatCard
                        label="Gebrachte User"
                        value={stats ? stats.referredUsers.toString() : "—"}
                        icon={Users}
                        color="bg-blue-500/10 text-blue-400"
                        sub="Über deinen Code"
                    />
                    <StatCard
                        label="Konvertierte User"
                        value={stats ? stats.convertedUsers.toString() : "—"}
                        icon={TrendingUp}
                        color="bg-purple-500/10 text-purple-400"
                        sub="Zahlende Kunden"
                    />
                    <StatCard
                        label="Conversion Rate"
                        value={stats ? `${stats.conversionRate.toFixed(1)}%` : "—"}
                        icon={TrendingUp}
                        color="bg-accent/10 text-accent"
                        sub="Referred → Paid"
                    />
                    <StatCard
                        label="Cancel Rate"
                        value={stats ? `${stats.cancelRate.toFixed(1)}%` : "—"}
                        icon={XCircle}
                        color="bg-orange-500/10 text-orange-400"
                        sub="Gekündigte Abos"
                    />
                    <StatCard
                        label="Refund Rate"
                        value={stats ? `${stats.refundRate.toFixed(1)}%` : "—"}
                        icon={RefreshCw}
                        color="bg-red-500/10 text-red-400"
                        sub="Zurückerstattungen"
                    />
                </section>
            )}
        </div>
    );
}
