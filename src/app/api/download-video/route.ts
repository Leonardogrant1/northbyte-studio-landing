import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const videoUrl = searchParams.get("url");

        if (!videoUrl) {
            return NextResponse.json(
                { error: "No video URL provided" },
                { status: 400 }
            );
        }

        // Fetch the video from the external URL
        const response = await fetch(videoUrl);

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch video" },
                { status: response.status }
            );
        }

        // Get the video blob
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();

        // Return the video with appropriate headers
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "video/mp4",
                "Content-Disposition": `attachment; filename="video.mp4"`,
                "Content-Length": buffer.byteLength.toString(),
            },
        });
    } catch (error) {
        console.error("Error downloading video:", error);
        return NextResponse.json(
            { error: "Failed to download video" },
            { status: 500 }
        );
    }
}
