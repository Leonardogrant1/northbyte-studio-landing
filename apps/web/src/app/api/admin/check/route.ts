import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET() {
    try {
        const userId = await getAuthenticatedUserId();
        return NextResponse.json({ isAuthenticated: userId !== null });
    } catch (error) {
        console.error("Error checking admin status:", error);
        return NextResponse.json({ isAuthenticated: false }, { status: 500 });
    }
}
