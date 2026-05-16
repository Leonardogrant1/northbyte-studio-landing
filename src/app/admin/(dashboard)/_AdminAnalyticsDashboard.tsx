"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { AllProjectsView } from "@/components/admin/AllProjectsView";
import { SingleProjectView } from "@/components/admin/SingleProjectView";

function AnalyticsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app") as Id<"apps"> | null;
    const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` })();
    const thirtyAgo = (() => { const d = new Date(Date.now() - 29*86400000); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` })();
    const fromParam  = searchParams.get("from") || thirtyAgo;
    const toParam    = searchParams.get("to")   || todayStr;
    const currency   = searchParams.get("currency") ?? "USD";

    const apps = useQuery(api.apps.queries.getAll);

    const buildUrl = (params: Record<string, string | null>) => {
        const next = new URLSearchParams(searchParams.toString());
        for (const [k, v] of Object.entries(params)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
        }
        return `/admin?${next.toString()}`;
    };

    const handleSelectApp = (appId: Id<"apps"> | null) => {
        router.push(buildUrl({ app: appId ?? null }));
    };

    const handleRange = (from: string, to: string) => {
        router.push(buildUrl({ range: "custom", from, to }));
    };

    return (
        <div className="flex-1 overflow-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Analytics</h1>
                <p className="text-secondary">Übersicht und Statistiken</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                {apps && apps.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => handleSelectApp(null)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${!selectedAppId
                                    ? "bg-accent/10 border-accent text-accent"
                                    : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                                }`}
                        >
                            All Projects
                        </button>
                        {apps.map((app) => (
                            <button
                                key={app._id}
                                onClick={() => handleSelectApp(app._id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedAppId === app._id
                                        ? "bg-accent/10 border-accent text-accent"
                                        : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                                    }`}
                            >
                                {app.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={currency}
                        onChange={(e) => router.push(buildUrl({ currency: e.target.value }))}
                        className="bg-surface2/50 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent/50 transition-colors"
                    >
                        {["USD","EUR","GBP","AUD","CAD","JPY","BRL","KRW","CNY","MXN","SGD","SEK"].map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <DateRangePicker
                        from={fromParam}
                        to={toParam}
                        onChange={handleRange}
                    />
                </div>
            </div>

            {selectedAppId
                ? <SingleProjectView appId={selectedAppId} from={fromParam} to={toParam} currency={currency} />
                : <AllProjectsView range="custom" currency={currency} customFrom={fromParam} customTo={toParam} />
            }
        </div>
    );
}

export default function AdminAnalyticsDashboard() {
    return (
        <Suspense fallback={<div className="text-secondary">Loading...</div>}>
            <AnalyticsContent />
        </Suspense>
    );
}
