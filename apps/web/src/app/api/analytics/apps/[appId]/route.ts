import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";
import { decrypt } from "@/lib/encryption";
import { ltvBadge, rpiBadge, d2tBadge, t2pBadge } from "./helpers/badges";
import { getRangeDates, Range } from "./helpers/dates";
import { rcFetch } from "./helpers/revenuecat";
import { phFetch } from "./helpers/posthog";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ─── Types ────────────────────────────────────────────────────────────────────

export type RevenueType = "gross" | "proceeds";

export interface AnalyticsResult {
    currency: string;
    revenueType: RevenueType;
    revenue: { value: number; sparkline: number[]; subtitle: string };
    ltv: { value: number; sparkline: number[]; badge: string | null; subtitle: string };
    rpi: { value: number; sparkline: number[]; badge: string | null; subtitle: string };
    downloadToTrial: { value: number; sparkline: number[]; badge: string | null; subtitle: string };
    trialToPaid: { value: number; sparkline: number[]; badge: string | null; subtitle: string };
}


// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ appId: string }> }
) {
    const { userId, getToken } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const token = await getToken({ template: "convex" });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const convexAuth = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convexAuth.setAuth(token);
    const currentUser = await convexAuth.query(api.users.queries.getCurrentUser, {});
    if (!currentUser || currentUser.type !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { appId } = await params;
    const sp = request.nextUrl.searchParams;
    const range = (sp.get("range") ?? "7d") as Range;
    const fromParam = sp.get("from") ?? undefined;
    const toParam = sp.get("to") ?? undefined;
    const currency = sp.get("currency") ?? "USD";
    const revenueType = (sp.get("revenueType") ?? "gross") as RevenueType;

    const app = await convex.query(api.apps.queries.getById, {
        appId: appId as Id<"apps">,
    });

    if (!app) {
        return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const rcProjectId = app.revenueCatProjectId;
    const rcKeyEnc = app.revenueCatApiKeyEncrypted;
    const phProjectId = app.postHogProjectId;
    const installEvent = app.postHogInstallEvent ?? "Application Installed";
    const phApiKey = process.env.POSTHOG_API_KEY;

    const hasRC = !!(rcProjectId && rcKeyEnc);
    const hasPH = !!(phProjectId && phApiKey);

    if (!hasRC) {
        return NextResponse.json({ error: "not_configured" }, { status: 422 });
    }

    const { startDate, endDate } = getRangeDates(range, fromParam, toParam);
    const rcKey = decrypt(rcKeyEnc!);
    const proceedsSelector = revenueType === "proceeds"
        ? `&selectors=${encodeURIComponent(JSON.stringify({ revenue_type: "proceeds" }))}`
        : "";
    const chartParams = `?start_date=${startDate}&end_date=${endDate}&period=day&currency=${currency}`;

    // ── RevenueCat ──────────────────────────────────────────────────────────
    const [revData, subData, convData, trialsData] = await Promise.all([
        rcFetch(`/projects/${rcProjectId}/charts/revenue${chartParams}&realtime=false${proceedsSelector}`, rcKey).catch(() => null),
        rcFetch(`/projects/${rcProjectId}/charts/actives${chartParams}&realtime=false`, rcKey).catch(() => null),
        rcFetch(`/projects/${rcProjectId}/charts/trial_conversion_rate${chartParams}&realtime=true`, rcKey, 60).catch(() => null),
        rcFetch(`/projects/${rcProjectId}/charts/trials_new${chartParams}&realtime=false`, rcKey).catch(() => null),
    ]);

    // ── Revenue ──────────────────────────────────────────────────────────────
    let totalRevenue = 0;
    let revenueSparkline: number[] = [];
    if (revData?.summary) {
        totalRevenue = revenueType === "proceeds"
            ? (revData.summary.total?.Proceeds ?? 0)
            : (revData.summary.total?.Revenue ?? revData.summary.total_revenue ?? 0);
        revenueSparkline = (revData.values ?? []).map((row: number[]) => row[1] ?? 0);
    }

    // ── Paying customers (actives) ───────────────────────────────────────────
    let payingCustomers = 0;
    if (subData?.summary) {
        const values: number[][] = subData.values ?? [];
        const lastRow = values[values.length - 1];
        payingCustomers = lastRow?.[1] ?? subData.summary.total?.Actives ?? subData.summary.total?.Active ?? 0;
    }

    // ── Trial → Paid conversion rate ─────────────────────────────────────────
    let trialToPaidRate = 0;
    let trialSparkline: number[] = [];
    if (convData?.summary) {
        const raw: number = convData.summary.total?.["Conversion Rate"] ?? 0;
        trialToPaidRate = raw > 1 ? raw : raw * 100;
        const crIndex = (convData.measures ?? []).findIndex(
            (m: { display_name: string }) => m.display_name === "Conversion Rate"
        );
        if (crIndex !== -1) {
            trialSparkline = (convData.values ?? [])
                .filter((row: { measure: number }) => row.measure === crIndex)
                .sort((a: { cohort: number }, b: { cohort: number }) => a.cohort - b.cohort)
                .map((row: { value: number }) => {
                    const v = row.value ?? 0;
                    return v > 1 ? v : v * 100;
                });
        }
    }

    // ── New trials (RC) ──────────────────────────────────────────────────────
    let newTrials = 0;
    let newTrialsSparkline: number[] = [];
    if (trialsData?.summary) {
        const totals = trialsData.summary.total ?? {};
        newTrials = totals["New Trials"] ?? totals["Trial Starts"] ?? totals["Trials"] ?? 0;
        const idx = (trialsData.measures ?? []).findIndex(
            (m: { display_name: string }) => ["New Trials", "Trial Starts", "Trials"].includes(m.display_name)
        );
        if (idx !== -1) {
            newTrialsSparkline = (trialsData.values ?? [])
                .filter((row: { measure: number }) => row.measure === idx)
                .sort((a: { cohort: number }, b: { cohort: number }) => a.cohort - b.cohort)
                .map((row: { value: number }) => row.value ?? 0);
        }
    }

    // ── Installs (PostHog HogQL) ─────────────────────────────────────────────
    let installCount = 0;
    let installSparkline: number[] = [];
    if (hasPH) {
        const safeEvent = installEvent.replace(/'/g, "\\'");
        const phData = await phFetch(
            `/api/projects/${phProjectId}/query`,
            phApiKey!,
            {
                query: {
                    kind: "HogQLQuery",
                    query: `SELECT toDate(timestamp) as date, count() as installs FROM events WHERE event = '${safeEvent}' AND toDate(timestamp) >= '${startDate}' AND toDate(timestamp) <= '${endDate}' GROUP BY date ORDER BY date ASC`,
                },
            }
        ).catch(() => null);

        if (phData?.results) {
            const rows: [string, number][] = phData.results;
            installCount = rows.reduce((sum, [, count]) => sum + count, 0);
            installSparkline = rows.map(([, count]) => count);
        }
    }

    // ── Derived metrics ──────────────────────────────────────────────────────
    const ltv = payingCustomers > 0 ? totalRevenue / payingCustomers : 0;
    const rpi = installCount > 0 ? totalRevenue / installCount : 0;
    const downloadToTrialRate = installCount > 0 ? (newTrials / installCount) * 100 : 0;
    const d2tSparkline = installSparkline.map((installs, i) =>
        installs > 0 ? ((newTrialsSparkline[i] ?? 0) / installs) * 100 : 0
    );

    const result: AnalyticsResult = {
        currency,
        revenueType,
        revenue: {
            value: totalRevenue,
            sparkline: revenueSparkline.length ? revenueSparkline : [0],
            subtitle: payingCustomers > 0 ? `${payingCustomers} paying customer${payingCustomers !== 1 ? "s" : ""}` : "No paying customers",
        },
        ltv: {
            value: ltv,
            sparkline: revenueSparkline.length ? revenueSparkline.map(r => payingCustomers > 0 ? r / payingCustomers : 0) : [0],
            badge: ltv > 0 ? ltvBadge(ltv) : null,
            subtitle: "Per paying customer (selected period)",
        },
        rpi: {
            value: rpi,
            sparkline: revenueSparkline.length ? revenueSparkline.map(r => installCount > 0 ? r / installCount : 0) : [0],
            badge: rpi > 0 ? rpiBadge(rpi) : null,
            subtitle: "Revenue per install (selected period)",
        },
        downloadToTrial: {
            value: downloadToTrialRate,
            sparkline: d2tSparkline.length ? d2tSparkline : [0],
            badge: downloadToTrialRate > 0 ? d2tBadge(downloadToTrialRate) : null,
            subtitle: "Trial start rate (selected period)",
        },
        trialToPaid: {
            value: trialToPaidRate,
            sparkline: trialSparkline.length ? trialSparkline : [0],
            badge: trialToPaidRate > 0 ? t2pBadge(trialToPaidRate) : null,
            subtitle: "Trial conversion rate (selected period)",
        },
    };

    return NextResponse.json(result);
}
