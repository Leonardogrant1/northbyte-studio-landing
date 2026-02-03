"use client";

interface VideoPlayerProps {
    videoUrl?: string;
}

export function VideoPlayer({ videoUrl }: VideoPlayerProps) {
    if (!videoUrl) {
        return (
            <div className="border border-border rounded-xl p-8 bg-surface2/30 flex items-center justify-center min-h-[300px]">
                <p className="text-muted text-center">
                    Select a content to view its video
                </p>
            </div>
        );
    }

    return (
        <div className="border border-border rounded-xl overflow-hidden bg-surface2 max-w-64">
            <video
                src={videoUrl}
                controls
                preload="metadata"
                className="w-full h-auto"
                key={videoUrl} // Force re-render when URL changes
            />
        </div>
    );
}
