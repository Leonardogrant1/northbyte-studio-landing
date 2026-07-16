import { NextRequest, NextResponse } from "next/server";
import { deleteR2Object } from "@/lib/r2";
import { getAuthenticatedUserId } from "@/lib/auth";
import { R2_BUCKETS } from "@/lib/r2-constants";
import { isCurrentUserAdmin } from "@/lib/is-admin";

// Whitelist: welche Key-Prefixe in welchem Bucket gelöscht werden dürfen
const DELETABLE: { bucket: R2_BUCKETS; pattern: RegExp }[] = [
    { bucket: R2_BUCKETS.n8n, pattern: /^videos\/[^/]+$/ },
    { bucket: R2_BUCKETS.northbyte, pattern: /^user-attachments\/[^/]+\/[^/]+$/ },
];

export async function DELETE(request: NextRequest) {
    const clerkUserId = await getAuthenticatedUserId();
    let viaApiKey = false;
    if (!clerkUserId) {
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!apiKey || apiKey !== process.env.NORTHBYTE_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        viaApiKey = true;
    }

    try {
        const { key, bucket } = (await request.json()) as { key?: string; bucket?: string };

        if (!key || typeof key !== "string") {
            return NextResponse.json({ error: "key is required" }, { status: 400 });
        }

        // Ohne bucket-Angabe: bisheriges Verhalten (n8n) für bestehende Caller
        const targetBucket = bucket ?? R2_BUCKETS.n8n;
        const rule = DELETABLE.find((r) => r.bucket === targetBucket && r.pattern.test(key));
        if (!rule) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
        }

        if (rule.bucket === R2_BUCKETS.northbyte && !viaApiKey) {
            if (!(await isCurrentUserAdmin())) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        await deleteR2Object(rule.bucket, key);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting R2 object:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
