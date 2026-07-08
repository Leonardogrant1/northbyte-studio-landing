import { NextRequest, NextResponse } from "next/server";
import { getMotionControlTask } from "@/lib/kling";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        const { taskId } = await params;
        const data = await getMotionControlTask(taskId);

        return NextResponse.json({
            taskId: data.task_id,
            status: data.task_status,
            statusMsg: data.task_status_msg ?? null,
            videoUrl: data.task_result?.videos?.[0]?.url ?? null,
            duration: data.task_result?.videos?.[0]?.duration ?? null,
        });
    } catch (err) {
        console.error("[motion-control/poll]", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to get task status." },
            { status: 500 }
        );
    }
}
