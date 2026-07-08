"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import Link from "next/link";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import type { AnalyticsResult, RevenueType } from "@/app/api/analytics/apps/[appId]/route";
import { MetricCard } from "./MetricCard";
function MetricCardSkeleton() {
    return (
        <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-6 flex flex-col gap-3 min-w-0 animate-pulse">
            <div className="h-4 bg-surface rounded w-2/3" />
            <div className="h-8 bg-surface rounded w-1/2 mt-2" />
            <div className="h-3 bg-surface rounded w-3/4" />
        </div>
    );
}

export interface SingleProjectViewProps {
    appId: Id<"apps">;
    from: string;
    to: string;
    currency: string;
}

function formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function SingleProjectView({ appId, from, to, currency }: SingleProjectViewProps) {
    const [data, setData] = useState<AnalyticsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revenueType, setRevenueType] = useState<RevenueType>("gross");

    useEffect(() => {
        setLoading(true);
        setError(null);
        setData(null);

        const params = new URLSearchParams({ range: "custom", currency, revenueType });
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        fetch(`/api/analytics/apps/${appId}?${params}`)
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    if (body.error === "not_configured") {
                        setError("not_configured");
                    } else {
                        setError(body.error ?? "Failed to load analytics");
                    }
                    return;
                }
                setData(await res.json());
            })
            .catch(() => setError("Failed to load analytics"))
            .finally(() => setLoading(false));
    }, [appId, from, to, currency, revenueType]);

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)}
            </div>
        );
    }

    if (error === "not_configured") {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <Settings size={36} className="text-secondary" />
                <p className="text-secondary text-sm max-w-xs">
                    Analytics credentials are not yet configured for this app.
                </p>
                <Link
                    href={`/admin/apps?app=${appId}`}
                    className="px-4 py-2 text-sm font-medium bg-accent/10 text-accent border border-accent/30 rounded-xl hover:bg-accent/20 transition-all"
                >
                    Configure in App Settings
                </Link>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center py-16 text-secondary text-sm">
                {error ?? "No data"}
            </div>
        );
    }

    const { revenue, ltv, rpi, downloadToTrial, trialToPaid } = data;
    const fmt = (v: number) => formatMoney(v, data.currency);
    return (
        <div className="flex flex-col gap-4">
            {/* Revenue type toggle */}
            <div className="flex items-center gap-1 self-start bg-surface2/50 border border-border rounded-xl p-1">
                {(["gross", "proceeds"] as RevenueType[]).map((type) => (
                    <button
                        key={type}
                        onClick={() => setRevenueType(type)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            revenueType === type
                                ? "bg-accent/10 text-accent border border-accent/30"
                                : "text-secondary hover:text-primary"
                        }`}
                    >
                        {type === "gross" ? "Gross Revenue" : "Proceeds"}
                    </button>
                ))}
            </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
                label="Total Revenue"
                value={fmt(revenue.value)}
                sparkline={revenue.sparkline}
                badge={null}
                subtitle={revenue.subtitle}
                sparklineColor="#5EE7FF"
            />
            <MetricCard
                label="LTV"
                value={fmt(ltv.value)}
                sparkline={ltv.sparkline}
                badge={ltv.badge}
                subtitle={ltv.subtitle}
                sparklineColor="#5EE7FF"
            />
            <MetricCard
                label="RPI"
                value={fmt(rpi.value)}
                sparkline={rpi.sparkline}
                badge={rpi.badge}
                subtitle={rpi.subtitle}
                sparklineColor="#FF6B6B"
            />
            <MetricCard
                label="Download to Trial"
                value={`${downloadToTrial.value.toFixed(1)}%`}
                sparkline={downloadToTrial.sparkline}
                badge={downloadToTrial.badge}
                subtitle={downloadToTrial.subtitle}
                sparklineColor="#FFD93D"
            />
            <MetricCard
                label="Trial to Paid"
                value={`${trialToPaid.value.toFixed(1)}%`}
                sparkline={trialToPaid.sparkline}
                badge={trialToPaid.badge}
                subtitle={trialToPaid.subtitle}
                sparklineColor="#FF6B6B"
            />
        </div>
        </div>
    );
}
