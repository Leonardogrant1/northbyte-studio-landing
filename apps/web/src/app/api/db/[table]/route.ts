import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { checkInternalApiSecret } from "@/lib/internal-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function applyLimit(records: unknown[], limit: number | null): unknown[] {
    if (!limit || limit <= 0) return records;
    return records.slice(0, limit);
}

function applySorting(records: unknown[], sortParam: string | null): unknown[] {
    if (!sortParam) return records;

    const [field, rawOrder] = sortParam.split(":");
    const order = rawOrder === "asc" ? 1 : -1;

    return [...records].sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aVal = (a as any)[field];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bVal = (b as any)[field];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (typeof aVal === "string" && typeof bVal === "string") {
            return aVal.localeCompare(bVal) * order;
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
            return (aVal - bVal) * order;
        }
        return 0;
    });
}

const ALLOWED_TABLES = [
    "social_accounts",
    "posts",
    "media",
    "ai_avatars",
    "users",
];

export const revalidate = 0;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ table: string }> }
) {
    if (!checkInternalApiSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
        return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const filtersParam = searchParams.get("filters");
        const field = searchParams.get("field");
        const value = searchParams.get("value");
        const exists = searchParams.get("exists");
        const sort = searchParams.get("sort");
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : null;

        if (filtersParam) {
            let filters: Record<string, unknown>;
            try {
                filters = JSON.parse(filtersParam);
            } catch {
                return NextResponse.json({ error: "Invalid JSON in 'filters' parameter" }, { status: 400 });
            }

            const conditions = Object.entries(filters).map(([f, v]) => {
                if (typeof v === "object" && v !== null && "exists" in v) {
                    return { field: f, exists: Boolean((v as Record<string, unknown>).exists) };
                }
                if (typeof v === "object" && v !== null && "contains" in v) {
                    return { field: f, contains: String((v as Record<string, unknown>).contains) };
                }
                if (typeof v === "object" && v !== null && "containedIn" in v) {
                    return { field: f, containedIn: String((v as Record<string, unknown>).containedIn) };
                }
                return { field: f, value: v };
            });

            const raw = await convex.query(api.generic.queries.findByFilters, { table, conditions });
            return NextResponse.json({ success: true, records: applyLimit(applySorting(raw, sort), limit) }, { status: 200 });
        }

        if (field && (value !== null || exists !== null)) {
            const raw = await convex.query(api.generic.queries.findByField, {
                table,
                field,
                ...(exists !== null ? { exists: exists === "true" } : { value }),
            });
            return NextResponse.json({ success: true, records: applyLimit(applySorting(raw, sort), limit) }, { status: 200 });
        }

        const raw = await convex.query(api.generic.queries.getAll, { table });
        return NextResponse.json({ success: true, records: applyLimit(applySorting(raw, sort), limit) }, { status: 200 });
    } catch (error) {
        console.error(`Error querying table '${table}':`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ table: string }> }
) {
    if (!checkInternalApiSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
        return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { filters, patch } = body as { filters?: Record<string, unknown>; patch: Record<string, unknown> };

        if (!patch || typeof patch !== "object") {
            return NextResponse.json({ error: "'patch' is required" }, { status: 400 });
        }

        let records: { _id: string }[];

        if (filters) {
            const conditions = Object.entries(filters).map(([f, v]) => {
                if (typeof v === "object" && v !== null && "exists" in v) {
                    return { field: f, exists: Boolean((v as Record<string, unknown>).exists) };
                }
                if (typeof v === "object" && v !== null && "contains" in v) {
                    return { field: f, contains: String((v as Record<string, unknown>).contains) };
                }
                if (typeof v === "object" && v !== null && "containedIn" in v) {
                    return { field: f, containedIn: String((v as Record<string, unknown>).containedIn) };
                }
                return { field: f, value: v };
            });
            records = await convex.query(api.generic.queries.findByFilters, { table, conditions }) as { _id: string }[];
        } else {
            records = await convex.query(api.generic.queries.getAll, { table }) as { _id: string }[];
        }

        await Promise.all(
            records.map((r) => convex.mutation(api.generic.mutations.updateById, { id: r._id, patch }))
        );

        return NextResponse.json({ success: true, updated: records.length }, { status: 200 });
    } catch (error) {
        console.error(`Error updating table '${table}':`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
