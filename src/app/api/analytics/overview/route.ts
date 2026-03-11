import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { isAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { getRangeDates, Range } from "../apps/[appId]/helpers/dates";
import { rcFetch } from "../apps/[appId]/helpers/revenuecat";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface OverviewResult {
    currency: string;
    totalRevenue: number;
    totalProceeds: number;
    appCount: number;
}

export async function GET(request: NextRequest) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const range = (sp.get("range") ?? "7d") as Range;
    const fromParam = sp.get("from") ?? undefined;
    const toParam = sp.get("to") ?? undefined;
    const currency = sp.get("currency") ?? "USD";

    const apps = await convex.query(api.apps.queries.getAll);
    const { startDate, endDate } = getRangeDates(range, fromParam, toParam);

    const proceedsSelector = `&selectors=${encodeURIComponent(JSON.stringify({ revenue_type: "proceeds" }))}`;

    const results = await Promise.all(
        apps.map(async (app) => {
            if (!app.revenueCatProjectId || !app.revenueCatApiKeyEncrypted) return null;

            const rcKey = decrypt(app.revenueCatApiKeyEncrypted);
            const baseParams = `?start_time=${startDate}&end_time=${endDate}&period=day&currency=USD&realtime=false`;

            const [metricsData, proceedsData] = await Promise.all([
                rcFetch(`/projects/${app.revenueCatProjectId}/metrics/overview${baseParams}`, rcKey).catch(() => null),
                rcFetch(`/projects/${app.revenueCatProjectId}/charts/revenue${baseParams}${proceedsSelector}`, rcKey).catch(() => null),
            ]);

            if (!metricsData?.metrics) return null;

            const metric = (metricsData.metrics as { id: string; value: number }[]).find(
                (m) => m.id === "revenue"
            );

            return {
                gross: metric?.value ?? 0,
                proceeds: proceedsData?.summary?.total?.Proceeds ?? 0,
            };
        })
    );

    const validResults = results.filter((r): r is { gross: number; proceeds: number } => r !== null);
    const totalRevenueUsd = validResults.reduce((sum, r) => sum + r.gross, 0);
    const totalProceedsUsd = validResults.reduce((sum, r) => sum + r.proceeds, 0);

    let totalRevenue = totalRevenueUsd;
    let totalProceeds = totalProceedsUsd;
    if (currency !== "USD") {
        const fx = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
        const fxData = await fx.json() as { rates: Record<string, number> };
        const rate = fxData.rates[currency] ?? 1;
        totalRevenue = Math.round(totalRevenueUsd * rate * 100) / 100;
        totalProceeds = Math.round(totalProceedsUsd * rate * 100) / 100;
    }

    return NextResponse.json({
        currency,
        totalRevenue,
        totalProceeds,
        appCount: validResults.length,
    } satisfies OverviewResult);
}
