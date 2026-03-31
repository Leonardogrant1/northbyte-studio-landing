import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getRangeDates, Range } from "../apps/[appId]/helpers/dates";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface ExpenseItem {
    _id: string;
    description: string;
    vendorName: string;
    categoryName: string;
    amount_usd: number;
    original_amount: number;
    original_currency: string;
    date: string;
}

export interface ExpensesResult {
    totalUsd: number;
    total: number;
    currency: string;
    expenses: ExpenseItem[];
}

export async function GET(request: NextRequest) {
    if (!(await getAuthenticatedUserId())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const range = (sp.get("range") ?? "7d") as Range;
    const fromParam = sp.get("from") ?? undefined;
    const toParam = sp.get("to") ?? undefined;
    const currency = sp.get("currency") ?? "USD";
    const { startDate, endDate } = getRangeDates(range, fromParam, toParam);

    const expenses = await convex.query(api.expenses.queries.getByDateRange, {
        startDate,
        endDate,
    });

    const totalUsd = expenses.reduce((sum, e) => sum + e.amount_usd, 0);

    let total = totalUsd;
    if (currency !== "USD") {
        const fx = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
        const fxData = await fx.json() as { rates: Record<string, number> };
        total = Math.round(totalUsd * (fxData.rates[currency] ?? 1) * 100) / 100;
    }

    return NextResponse.json({
        totalUsd,
        total,
        currency,
        expenses: expenses.map((e) => ({
            _id: e._id,
            description: e.description,
            vendorName: e.vendorName,
            categoryName: e.categoryName,
            amount_usd: e.amount_usd,
            original_amount: e.original_amount,
            original_currency: e.original_currency,
            date: e.date,
        })),
    } satisfies ExpensesResult);
}
