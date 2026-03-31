import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const revalidate = 0;

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const { accountId } = await params;

        if (!accountId) {
            return NextResponse.json(
                { error: "accountId is required" },
                { status: 400 }
            );
        }

        const posts = await convex.query(api.posts.queries.getReadyToPostByAccount, {
            accountId: accountId as Id<"social_accounts">,
        });

        return NextResponse.json(
            { success: true, posts },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error fetching posts:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
