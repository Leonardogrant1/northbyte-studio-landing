"use client";

import { useEffect, useState, useRef } from "react";
import { Creator, SocialMediaAccount } from "@/types";
import { AssetDropper, AssetDropperRef } from "@/components/admin/AssetDropper";
import { Loader2, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { R2_BUCKETS } from "@/lib/r2";

export default function CreatorPostClient({ creatorId }: { creatorId: string }) {
    const [creator, setCreator] = useState<Creator | null>(null);
    const [accounts, setAccounts] = useState<SocialMediaAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

    // Form State
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState("");
    const [isScheduling, setIsScheduling] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const assetDropperRef = useRef<AssetDropperRef>(null);

    useEffect(() => {
        const fetchCreatorData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/creators/${creatorId}`);
                const data = await res.json();

                if (data.success) {
                    setCreator(data.creator);
                    setAccounts(data.accounts || []);
                } else {
                    setError(data.error || "Failed to load creator");
                }
            } catch (err) {
                setError("An error occurred while fetching creator data.");
            } finally {
                setLoading(false);
            }
        };

        if (creatorId) {
            fetchCreatorData();
        }
    }, [creatorId]);

    const handleAccountToggle = (accountId: string) => {
        setSelectedAccounts(prev =>
            prev.includes(accountId)
                ? prev.filter(id => id !== accountId)
                : [...prev, accountId]
        );
    };

    const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newTag = hashtagInput.trim().replace(/^#/, '');
            if (newTag && !hashtags.includes(newTag)) {
                setHashtags([...hashtags, newTag]);
                setHashtagInput("");
            }
        }
    };

    const removeHashtag = (tagToRemove: string) => {
        setHashtags(hashtags.filter(tag => tag !== tagToRemove));
    };

    const handleSchedule = async () => {
        // Validation
        const videoFile = assetDropperRef.current?.getSelectedFile();
        if (!videoFile) {
            toast.error("Please select a video file.");
            return;
        }
        if (selectedAccounts.length === 0) {
            toast.error("Please select at least one account.");
            return;
        }
        if (!title.trim()) {
            toast.error("Please enter a title.");
            return;
        }

        setIsScheduling(true);
        setUploadProgress(0);

        try {
            // 1. Upload Video via Presigned URL (avoids Next.js 4MB/10MB limits)
            const presignedRes = await fetch("/api/r2/upload-url", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    bucket: R2_BUCKETS.n8n,
                    fileName: videoFile.name,
                    fileType: videoFile.type,
                }),
            });

            if (!presignedRes.ok) {
                throw new Error("Failed to get presigned upload URL from server");
            }

            const { uploadUrl, downloadUrl } = await presignedRes.json();

            // Perform direct PUT to Cloudflare R2
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(percentComplete);
                    }
                });

                xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });

                xhr.addEventListener("error", () => {
                    reject(new Error("Network error during upload"));
                });

                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", videoFile.type);
                xhr.send(videoFile);
            });

            const finalVideoUrl = downloadUrl;
            setUploadProgress(0); // Hide progress bar while saving to Airtable

            // 2. Schedule Post
            const schedulePayload = {
                creatorId,
                videoUrl: finalVideoUrl,
                title,
                description,
                hashtags,
                selectedAccounts
            };

            const scheduleRes = await fetch("/api/posts/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(schedulePayload),
            });

            const scheduleData = await scheduleRes.json();

            if (scheduleData.success) {
                toast.success("Post scheduled successfully!");
                // Clear form
                setTitle("");
                setDescription("");
                setHashtags([]);
                setSelectedAccounts([]);
                assetDropperRef.current?.clearSelection();
            } else {
                toast.error("Failed to schedule post.");
            }
        } catch (err) {
            console.error(err);
            toast.error("An error occurred during scheduling.");
        } finally {
            setIsScheduling(false);
        }
    };


    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    if (error || !creator) {
        return (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-center">
                {error || "Creator not found"}
            </div>
        );
    }

    return (
        <div className="space-y-10">
            {/* Header */}
            <header className="flex items-center gap-4 bg-surface2 p-6 rounded-2xl border border-border">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center overflow-hidden border-2 border-accent">
                    {creator.image && creator.image[0] ? (
                        <img src={creator.image[0].url} alt={creator.name} className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-2xl font-bold text-accent">{creator.name?.charAt(0) || "?"}</span>
                    )}
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{creator.name}</h1>
                    <p className="text-muted text-sm">Create and schedule your next post</p>
                </div>
            </header>

            {/* Account Selector */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Select Accounts</h2>
                <div className="flex flex-wrap gap-3">
                    {accounts.map(acc => {
                        const isSelected = selectedAccounts.includes(acc.id);
                        return (
                            <button
                                key={acc.id}
                                onClick={() => handleAccountToggle(acc.id)}
                                className={`px-4 py-2 rounded-full border transition-all ${isSelected
                                    ? "bg-accent border-accent text-white"
                                    : "bg-surface border-border hover:border-accent/50 text-muted"
                                    }`}
                            >
                                {acc.Platform}: @{acc.Username}
                            </button>
                        );
                    })}
                    {accounts.length === 0 && (
                        <p className="text-sm text-yellow-500/80">No accounts linked to this creator.</p>
                    )}
                </div>
            </section>

            {/* Video Upload */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold">Video Upload</h2>
                <div className="bg-surface2 p-6 rounded-2xl border border-border flex justify-center">
                    <AssetDropper ref={assetDropperRef} aspectRatio="16:9" />
                </div>
            </section>

            {/* Post Details */}
            <section className="space-y-6">
                <h2 className="text-xl font-semibold">Post Details</h2>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted">Title (Internal or Platform Specific)</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="My awesome post..."
                        className="w-full rounded-xl bg-surface2 border border-border px-4 py-3 outline-none focus:border-accent transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted">Description / Caption</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Write an engaging caption..."
                        rows={4}
                        className="w-full rounded-xl bg-surface2 border border-border px-4 py-3 outline-none focus:border-accent transition-colors resize-none"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted">Hashtags (Press Enter to add)</label>
                    <div className="w-full rounded-xl bg-surface2 border border-border p-2 focus-within:border-accent transition-colors flex flex-wrap gap-2 items-center">
                        {hashtags.map(tag => (
                            <span key={tag} className="flex items-center gap-1 bg-background px-3 py-1 rounded-full text-sm">
                                #{tag}
                                <button onClick={() => removeHashtag(tag)} className="text-muted hover:text-red-400">×</button>
                            </span>
                        ))}
                        <input
                            type="text"
                            value={hashtagInput}
                            onChange={(e) => setHashtagInput(e.target.value)}
                            onKeyDown={handleHashtagKeyDown}
                            placeholder={hashtags.length === 0 ? "Add hashtags..." : ""}
                            className="flex-1 bg-transparent min-w-[120px] outline-none px-2 py-1"
                        />
                    </div>
                </div>
            </section>

            {/* Schedule Button Row */}
            <div className="pt-6 border-t border-border flex justify-end cursor-pointer">
                <button
                    onClick={handleSchedule}
                    disabled={isScheduling}
                    className="flex flex-col items-center justify-center gap-2 min-w-[200px] min-h-[56px] bg-accent hover:bg-accent/90 text-white px-8 py-2 rounded-xl font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    {isScheduling ? (
                        <div className="flex flex-col items-center w-full gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>{uploadProgress > 0 && uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Scheduling..."}</span>
                            </div>
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="w-full bg-black/20 rounded-full h-1.5">
                                    <div
                                        className="bg-white h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            <span>Schedule Post</span>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}
