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
        const field = searchParams.get("field");
        const value = searchParams.get("value");

        if (field && value !== null) {
            const records = await convex.query(api.generic.queries.findByField, {
                table,
                field,
                value,
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
