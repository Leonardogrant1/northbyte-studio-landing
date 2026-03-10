import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type RequestBody = {
    description: string;
    source_invoice_id: string;
    source_id: Id<"sources">;
    category_id: Id<"categories">;
    original_amount: number;
    original_currency: string;
    amount_usd: number;
    tax_amount?: number;
    date: string;
    urls?: string[];
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as RequestBody;
        const {
            description,
            source_invoice_id,
            source_id,
            category_id,
            original_amount,
            original_currency,
            amount_usd,
            tax_amount,
            date,
            urls,
        } = body;

        if (
            !description ||
            !source_invoice_id ||
            !source_id ||
            !category_id ||
            original_amount === undefined ||
            !original_currency ||
            amount_usd === undefined ||
            !date
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const expenseId = await convex.mutation(api.expenses.mutations.create, {
            description,
            source_invoice_id,
            source_id: source_id as Id<"sources">,
            category_id: category_id as Id<"categories">,
            original_amount: Number(original_amount),
            original_currency,
            amount_usd: Number(amount_usd),
            tax_amount: tax_amount !== undefined ? Number(tax_amount) : undefined,
            date,
            urls,
        });

        return NextResponse.json(
            { success: true, expenseId, message: "Expense added successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error adding expense:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
