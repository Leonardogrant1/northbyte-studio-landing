"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AssetDropper, AssetDropperRef } from "@/components/admin/AssetDropper";
import { ContentDropdown } from "@/components/admin/ContentDropdown";
import { VideoPlayer } from "@/components/admin/VideoPlayer";
import { Content } from "@/types";


export default function ApproveVideosPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isChecking, setIsChecking] = useState(true);
    const [selectedContent, setSelectedContent] = useState<Content | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const assetDropperRef = useRef<AssetDropperRef>(null);

    // Fetch contents with React Query
    const { data: contents = [], isLoading: isLoadingContents } = useQuery({
        queryKey: ["contents"],
        queryFn: async () => {
            const response = await fetch("/api/airtable/contents");
            if (!response.ok) throw new Error("Failed to fetch contents");
            const data = await response.json();
            return data.contents as Content[];
        },
    });

    // Approve video mutation
    const approveVideoMutation = useMutation({
        mutationFn: async ({ file, contentId }: { file: File; contentId: string }) => {
            // Upload to n8n
            const endpoint = "https://n8n-video-merger-38873740272.europe-west3.run.app/videos/store";
            const formData = new FormData();
            formData.append("video", file);

            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to upload video");
            }

            const data = (await response.json()) as {
                success: boolean;
                download_url: string;
            };

            // Update Airtable
            const updateResponse = await fetch("/api/airtable/update-content", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: contentId,
                    mediaUrl: data.download_url,
                    status: "Ready For Scheduling",
                }),
            });

            if (!updateResponse.ok) {
                throw new Error("Failed to update Airtable");
            }

            return data;
        },
        onSuccess: () => {
            // Refetch contents after successful approval
            queryClient.invalidateQueries({ queryKey: ["contents"] });
            // Clear selection
            assetDropperRef.current?.clearSelection();
            setSelectedFile(null);
            setSelectedContent(null);
            console.log("Video approved and Airtable updated successfully");
        },
        onError: (error) => {
            console.error("Failed to approve video:", error);
        },
    });

    const approveContent = async () => {
        if (!selectedFile || !selectedContent) return;
        approveVideoMutation.mutate({
            file: selectedFile,
            contentId: selectedContent.id,
        });
    };

    const downloadVideo = async () => {
        if (!selectedContent) return;
        const videoUrl = selectedContent["Unedited Media"];
        const fileName = selectedContent["Title"]
            ? `${selectedContent["Title"]}_unedited.mp4`
            : "unedited_video.mp4";

        try {
            // Use proxy API to avoid CORS issues
            const proxyUrl = `/api/download-video?url=${encodeURIComponent(videoUrl)}`;
            const a = document.createElement('a');
            a.href = proxyUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
            // Fallback: open in new tab
            window.open(videoUrl, '_blank');
        }
    }

    useEffect(() => {
        // Check admin status
        fetch("/api/admin/check")
            .then((res) => res.json())
            .then((data) => {
                if (!data.isAdmin) {
                    router.push("/admin/login");
                } else {
                    setIsChecking(false);
                }
            })
            .catch(() => {
                router.push("/admin/login");
            });
    }, [router]);

    if (isChecking) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto">
                <AdminHeader />

                <div className="mt-20">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-primary mb-2">
                            Approve Videos
                        </h1>
                        <p className="text-muted">
                            Select content from Airtable and upload approved videos
                        </p>
                    </div>

                    {/* Content Selector */}
                    <div className="mb-20">
                        <label className="block text-sm font-medium text-primary mb-2">
                            Select Content
                        </label>
                        <ContentDropdown
                            contents={contents}
                            selectedContent={selectedContent}
                            onSelectContent={setSelectedContent}
                            isLoading={isLoadingContents}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left side - Video player */}
                        <div className="space-y-4 flex flex-col items-center">
                            <h2 className="text-xl font-semibold text-primary">
                                Unedited Video
                            </h2>
                            <VideoPlayer videoUrl={selectedContent?.["Unedited Media"]} />
                            {selectedContent?.["Unedited Media"] && (
                                <button
                                    onClick={downloadVideo}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-medium hover:bg-accent/90 transition-all"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Video
                                </button>
                            )}
                        </div>

                        {/* Right side - Asset Dropper */}
                        <div className="space-y-4 flex flex-col items-center">
                            <h2 className="text-xl font-semibold text-primary">
                                Edited Video
                            </h2>
                            <div className="max-w-sm">
                                <AssetDropper
                                    ref={assetDropperRef}
                                    onFileSelected={(file) => setSelectedFile(file)}
                                />
                            </div>
                            {selectedFile && <button
                                onClick={approveContent}
                                disabled={approveVideoMutation.isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {approveVideoMutation.isPending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Approving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Approve Video
                                    </>
                                )}
                            </button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
