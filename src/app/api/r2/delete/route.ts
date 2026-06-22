import { NextRequest, NextResponse } from "next/server";
import { deleteR2Object } from "@/lib/r2";
import { R2_BUCKETS } from "@/lib/r2-constants";

export async function DELETE(request: NextRequest) {
    try {
        const { key } = await request.json();

        if (!key || typeof key !== "string") {
            return NextResponse.json({ error: "key is required" }, { status: 400 });
        }

        // Only allow deletion of keys under the videos/ prefix
        if (!/^videos\/[^/]+$/.test(key)) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
        }

        await deleteR2Object(R2_BUCKETS.n8n, key);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting R2 object:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
