import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { checkInternalApiSecret } from "@/lib/internal-auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
                return { field: f, value: v };
            });

            const records = await convex.query(api.generic.queries.findByFilters, { table, conditions });
            return NextResponse.json({ success: true, records }, { status: 200 });
        }

        if (field && (value !== null || exists !== null)) {
            const records = await convex.query(api.generic.queries.findByField, {
                table,
                field,
                ...(exists !== null ? { exists: exists === "true" } : { value }),
            });
            return NextResponse.json({ success: true, records }, { status: 200 });
        }

        const records = await convex.query(api.generic.queries.getAll, { table });
        return NextResponse.json({ success: true, records }, { status: 200 });
    } catch (error) {
        console.error(`Error querying table '${table}':`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
