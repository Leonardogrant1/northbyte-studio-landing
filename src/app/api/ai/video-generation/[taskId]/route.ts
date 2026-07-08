import { NextRequest, NextResponse } from "next/server";
import { getVideoGenTask } from "@/lib/kling";
import type { KlingVgType } from "@/lib/kling";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const type = (request.nextUrl.searchParams.get("type") ?? "text") as KlingVgType;

        const data = await getVideoGenTask(taskId, type);

        const videoUrl = data.task_result?.videos?.[0]?.url ?? null;

        return NextResponse.json({
            status: data.task_status,
            statusMsg: data.task_status_msg ?? null,
            videoUrl,
        });
    } catch (err) {
        console.error("[video-generation/poll]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch task status." },
            { status: 500 }
        );
    }
}
