import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { deleteR2Object } from "@/lib/r2";
import { R2_BUCKETS } from "@/lib/r2-constants";

// Admin-only — löscht einen User vollständig: Clerk-Account, R2-Anhänge und
// Convex-Daten (Cascade in users.mutations.deleteUser). Reihenfolge so gewählt,
// dass ein Fehlschlag mitten im Ablauf per erneutem Aufruf reparierbar bleibt:
// erst Clerk (idempotent, 404 wird toleriert), dann R2, zuletzt die DB — solange
// die DB-Zeile existiert, kann der Admin die Löschung einfach wiederholen.
export async function POST(request: NextRequest) {
    let token: string | null = null;
    try {
        const { getToken } = await auth();
        token = await getToken({ template: "convex" });
    } catch {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = (await request.json()) as { userId?: string };
    if (!userId || typeof userId !== "string") {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    try {
        // Enthält dieselben Guards wie die Mutation (Admin-Check, kein Selbst-/Admin-Delete),
        // damit hier nichts gelöscht wird, was die Mutation später ablehnen würde.
        const info = await convex.query(api.users.queries.getDeletionInfo, {
            userId: userId as Id<"users">,
        });
        if (!info) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Clerk zuerst: entzieht sofort den Login. 404 = bereits gelöscht (Retry).
        const clerk = await clerkClient();
        try {
            await clerk.users.deleteUser(info.clerkId);
        } catch (error) {
            const status = (error as { status?: number }).status;
            if (status !== 404) throw error;
        }

        for (const key of info.fileKeys) {
            try {
                await deleteR2Object(R2_BUCKETS.northbyte, key);
            } catch (error) {
                // Verwaiste R2-Datei blockiert die Löschung nicht — nur protokollieren.
                console.error(`Failed to delete R2 object ${key}:`, error);
            }
        }

        await convex.mutation(api.users.mutations.deleteUser, {
            userId: userId as Id<"users">,
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting user:", error);
        const message = error instanceof Error ? error.message : "Failed to delete user";
        const forbidden = message.includes("Unauthorized") || message.includes("Unauthenticated");
        return NextResponse.json(
            { error: message },
            { status: forbidden ? 403 : 500 }
        );
    }
}
