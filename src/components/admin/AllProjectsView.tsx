"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { OverviewResult } from "@/app/api/analytics/overview/route";

interface Props {
    range: string;
    currency: string;
    customFrom?: string;
    customTo?: string;
}

export function AllProjectsView({ range, currency, customFrom, customTo }: Props) {
    const [data, setData] = useState<OverviewResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams({ range, currency });
        if (customFrom) params.set("from", customFrom);
        if (customTo) params.set("to", customTo);

        fetch(`/api/analytics/overview?${params}`)
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [range, currency, customFrom, customTo]);

    const formatRevenue = (value: number) =>
        `${currency === "USD" ? "$" : ""}${value.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency !== "USD" ? currency : ""}`.trim();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
                label="Total Revenue"
                value={loading ? "—" : formatRevenue(data?.totalRevenue ?? 0)}
                sparkline={[0]}
                subtitle={loading ? "Loading…" : `across ${data?.appCount ?? 0} app${data?.appCount !== 1 ? "s" : ""}`}
                sparklineColor="#5EE7FF"
            />
        </div>
    );
}
