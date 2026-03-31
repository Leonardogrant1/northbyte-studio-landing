import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { getAuthenticatedUserId } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ appId: string }> }
) {
    if (!(await getAuthenticatedUserId())) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { appId } = await params;
    const body = await request.json();
    const {
        revenueCatProjectId,
        revenueCatApiKey,
        postHogProjectId,
        postHogApiKey,
        postHogInstallEvent,
        postHogTrialEvent,
    } = body;

    const updates: Record<string, string> = {};

    if (revenueCatProjectId !== undefined) updates.revenueCatProjectId = revenueCatProjectId;
    if (revenueCatApiKey)    updates.revenueCatApiKeyEncrypted = encrypt(revenueCatApiKey);
    if (postHogProjectId !== undefined) updates.postHogProjectId = postHogProjectId;
    if (postHogApiKey)       updates.postHogApiKeyEncrypted = encrypt(postHogApiKey);
    if (postHogInstallEvent !== undefined) updates.postHogInstallEvent = postHogInstallEvent;
    if (postHogTrialEvent !== undefined)   updates.postHogTrialEvent   = postHogTrialEvent;

    await convex.mutation(api.apps.mutations.update, {
        appId: appId as Id<"apps">,
        ...updates,
    });

    return NextResponse.json({ success: true });
}
