import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing required id" },
                { status: 400 }
            );
        }

        await convex.mutation(api.expenses.mutations.remove, {
            id: id as Id<"expenses">
        });


        return NextResponse.json(
            { success: true, message: "Expense deleted successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error deleting expense:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
