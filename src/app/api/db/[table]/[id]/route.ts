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
    { params }: { params: Promise<{ table: string; id: string }> }
) {
    if (!checkInternalApiSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table, id } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
        return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    try {
        const record = await convex.query(api.generic.queries.getById, { id });

        if (!record) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, record }, { status: 200 });
    } catch (error) {
        console.error(`Error fetching record '${id}' from '${table}':`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ table: string; id: string }> }
) {
    if (!checkInternalApiSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { table, id } = await params;

    if (!ALLOWED_TABLES.includes(table)) {
        return NextResponse.json({ error: `Table '${table}' is not allowed` }, { status: 400 });
    }

    try {
        const patch = await request.json();

        const record = await convex.mutation(api.generic.mutations.updateById, { id, patch });

        return NextResponse.json({ success: true, record }, { status: 200 });
    } catch (error) {
        console.error(`Error updating record '${id}' in '${table}':`, error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
