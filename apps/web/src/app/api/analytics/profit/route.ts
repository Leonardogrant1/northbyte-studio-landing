import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { decrypt } from "@/lib/encryption";
import { getRangeDates, Range } from "../apps/[appId]/helpers/dates";
import { rcFetch } from "../apps/[appId]/helpers/revenuecat";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface ProfitResult {
    profitUsd: number;
    profit: number;
    currency: string;
}

export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams;
    const range = (sp.get("range") ?? "7d") as Range;
    const fromParam = sp.get("from") ?? undefined;
    const toParam = sp.get("to") ?? undefined;
    const currency = sp.get("currency") ?? "USD";
    const { startDate, endDate } = getRangeDates(range, fromParam, toParam);

    const apps = await convex.query(api.apps.queries.getAll);
    const proceedsSelector = `&selectors=${encodeURIComponent(JSON.stringify({ revenue_type: "proceeds" }))}`;

    const [revenueResults, expenses] = await Promise.all([
        Promise.all(
            apps.map(async (app) => {
                if (!app.revenueCatProjectId || !app.revenueCatApiKeyEncrypted) return null;
                const rcKey = decrypt(app.revenueCatApiKeyEncrypted);
                const params = `?start_date=${startDate}&end_date=${endDate}&period=day&currency=USD&realtime=false${proceedsSelector}`;
                const data = await rcFetch(
                    `/projects/${app.revenueCatProjectId}/charts/revenue${params}`,
                    rcKey
                ).catch(() => null);
                return data?.summary?.total?.Proceeds ?? null;
            })
        ),
        convex.query(api.expenses.queries.getByDateRange, { startDate, endDate }),
    ]);

    const revenueUsd = revenueResults
        .filter((r): r is number => r !== null)
        .reduce((sum, r) => sum + r, 0);

    const expensesUsd = expenses.reduce((sum, e) => sum + e.amount_usd, 0);
    const profitUsd = revenueUsd - expensesUsd;

    let profit = profitUsd;
    if (currency !== "USD") {
        const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
        const data = await res.json() as { rates: Record<string, number> };
        profit = Math.round(profitUsd * (data.rates[currency] ?? 1) * 100) / 100;
    }

    return NextResponse.json({ profitUsd, profit, currency } satisfies ProfitResult);
}
