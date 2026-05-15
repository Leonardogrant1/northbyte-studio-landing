"use client";

import { useState } from "react";
import { Copy, Check, DollarSign, Users, TrendingUp, RefreshCw, XCircle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// — Mockup data (everything except the promo code) —
const MOCK = {
    earned: 1240.5,
    referredUsers: 87,
    convertedUsers: 34,
    conversionRate: 39.1,
    cancelRate: 12.4,
    refundRate: 5.2,
};

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
    const user = useCurrentUser();
    const profile = useQuery(api.affiliate_profiles.queries.getMyProfile);
    const [copied, setCopied] = useState(false);

    const affiliateCode = profile?.affiliateCode ?? null;

    const handleCopy = () => {
        if (!affiliateCode) return;
        navigator.clipboard.writeText(affiliateCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const greeting = user?.name ? `Hey, ${user.name}` : "Hey";

    return (
        <div className="max-w-4xl space-y-10">
            <div>
                <h1 className="text-3xl font-bold mb-1">{greeting} 👋</h1>
                <p className="text-secondary">Dein Affiliate-Dashboard</p>
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
                        <p className="text-sm text-secondary font-medium mb-3">Deine Provision</p>
                        <p className="text-2xl font-bold text-primary">
                            {profile.commissionType === "percentage"
                                ? `${profile.commissionAmount}%`
                                : `$${profile.commissionAmount}`}
                        </p>
                        <p className="text-xs text-secondary/70 mt-1">
                            {profile.commissionType === "percentage" ? "Pro Conversion" : "Fester Betrag"}
                        </p>
                    </div>
                )}
            </section>

            {/* Stats Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    label="Verdient"
                    value={`$${MOCK.earned.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`}
                    icon={DollarSign}
                    color="bg-green-500/10 text-green-400"
                    sub="Gesamte Provisionen"
                />
                <StatCard
                    label="Gebrachte User"
                    value={MOCK.referredUsers.toString()}
                    icon={Users}
                    color="bg-blue-500/10 text-blue-400"
                    sub="Über deinen Code"
                />
                <StatCard
                    label="Konvertierte User"
                    value={MOCK.convertedUsers.toString()}
                    icon={TrendingUp}
                    color="bg-purple-500/10 text-purple-400"
                    sub="Zahlende Kunden"
                />
                <StatCard
                    label="Conversion Rate"
                    value={`${MOCK.conversionRate}%`}
                    icon={TrendingUp}
                    color="bg-accent/10 text-accent"
                    sub="Referred → Paid"
                />
                <StatCard
                    label="Cancel Rate"
                    value={`${MOCK.cancelRate}%`}
                    icon={XCircle}
                    color="bg-orange-500/10 text-orange-400"
                    sub="Gekündigte Abos"
                />
                <StatCard
                    label="Refund Rate"
                    value={`${MOCK.refundRate}%`}
                    icon={RefreshCw}
                    color="bg-red-500/10 text-red-400"
                    sub="Zurückerstattungen"
                />
            </section>
        </div>
    );
}
