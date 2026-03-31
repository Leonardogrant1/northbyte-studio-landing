"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AssetDropper, AssetDropperRef } from "@/components/admin/AssetDropper";
import { Calendar, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const inputClass = "w-full rounded-xl bg-surface2 border border-border px-4 py-3 text-primary text-sm outline-none focus:border-accent transition-colors";

export default function PostContentPage() {
    const { isAuthenticated } = useConvexAuth();
    const accounts = useQuery(api.social_accounts.queries.getMyAccounts, isAuthenticated ? {} : "skip");
    const createPost = useMutation(api.posts.mutations.create);

    const [selectedAccountId, setSelectedAccountId] = useState<Id<"social_accounts"> | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState("");
    const [isScheduling, setIsScheduling] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const assetDropperRef = useRef<AssetDropperRef>(null);

    const selectAccount = (id: Id<"social_accounts">) => {
        setSelectedAccountId((prev) => (prev === id ? null : id));
    };

    const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const tag = hashtagInput.trim().replace(/^#/, "");
            if (tag && !hashtags.includes(tag)) {
                setHashtags((h) => [...h, tag]);
                setHashtagInput("");
            }
        }
    };

    const handleSchedule = async () => {
        const videoFile = assetDropperRef.current?.getSelectedFile();
        if (!videoFile) { toast.error("Bitte ein Video auswählen."); return; }
        if (!selectedAccountId) { toast.error("Bitte einen Account auswählen."); return; }
        if (!title.trim()) { toast.error("Bitte einen Titel eingeben."); return; }

        setIsScheduling(true);
        setUploadProgress(0);

        try {
            // 1. Get presigned URL
            const presignedRes = await fetch("/api/r2/presigned-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: videoFile.name, fileType: videoFile.type }),
            });
            if (!presignedRes.ok) throw new Error("Presigned URL konnte nicht abgerufen werden.");
            const { uploadUrl, downloadUrl } = await presignedRes.json();

            // 2. Upload directly to R2 with progress tracking
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
                });
                xhr.addEventListener("load", () =>
                    xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`))
                );
                xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler beim Upload")));
                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", videoFile.type);
                xhr.send(videoFile);
            });

            setUploadProgress(0);

            // 3. Save post to Convex
            await createPost({
                title: title.trim(),
                description: description.trim() || undefined,
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                videoUrl: downloadUrl,
                accountId: selectedAccountId,
            });

            toast.success("Post erfolgreich geplant!");
            setTitle("");
            setDescription("");
            setHashtags([]);
            setSelectedAccountId(null);
            assetDropperRef.current?.clearSelection();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Planen.");
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold mb-1">Post Content</h1>
                <p className="text-secondary">Video hochladen und für Social-Media-Accounts planen.</p>
            </div>

            {/* Account selector */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">Accounts</h2>
                {accounts === undefined ? (
                    <div className="flex gap-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-9 w-36 rounded-full bg-surface2 animate-pulse" />
                        ))}
                    </div>
                ) : accounts.length === 0 ? (
                    <p className="text-sm text-secondary">Keine Accounts zugewiesen.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {accounts.map((acc) => {
                            const selected = selectedAccountId === acc._id;
                            return (
                                <button
                                    key={acc._id}
                                    onClick={() => selectAccount(acc._id)}
                                    className={`px-4 py-1.5 rounded-full border text-sm transition-all capitalize ${
                                        selected
                                            ? "bg-accent border-accent text-background font-medium"
                                            : "bg-surface2 border-border text-secondary hover:border-accent/50"
                                    }`}
                                >
                                    {acc.platform}: @{acc.username}
                                </button>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Video upload */}
            <section className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">Video</h2>
                <div className="bg-surface2 p-6 rounded-2xl border border-border flex justify-center">
                    <AssetDropper ref={assetDropperRef} aspectRatio="16:9" />
                </div>
            </section>

            {/* Post details */}
            <section className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">Details</h2>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Titel *</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="z.B. Summer Hook DE"
                        className={inputClass}
                        disabled={isScheduling}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Beschreibung / Caption</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Caption schreiben…"
                        rows={4}
                        className={inputClass + " resize-none"}
                        disabled={isScheduling}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-secondary">Hashtags (Enter zum Hinzufügen)</label>
                    <div className="w-full rounded-xl bg-surface2 border border-border p-2 focus-within:border-accent transition-colors flex flex-wrap gap-2 items-center">
                        {hashtags.map((tag) => (
                            <span key={tag} className="flex items-center gap-1 bg-surface border border-border px-3 py-1 rounded-full text-xs text-primary">
                                #{tag}
                                <button
                                    onClick={() => setHashtags((h) => h.filter((t) => t !== tag))}
                                    className="text-secondary hover:text-red-400 transition-colors"
                                >
                                    <X size={11} />
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            value={hashtagInput}
                            onChange={(e) => setHashtagInput(e.target.value)}
                            onKeyDown={handleHashtagKeyDown}
                            placeholder={hashtags.length === 0 ? "Hashtags hinzufügen…" : ""}
                            className="flex-1 bg-transparent min-w-[120px] outline-none px-2 py-1 text-sm"
                            disabled={isScheduling}
                        />
                    </div>
                </div>
            </section>

            {/* Submit */}
            <div className="pt-2 flex justify-end">
                <button
                    onClick={handleSchedule}
                    disabled={isScheduling}
                    className="flex flex-col items-center justify-center gap-2 min-w-[180px] min-h-[48px] bg-accent hover:opacity-90 text-background px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isScheduling ? (
                        <div className="flex flex-col items-center w-full gap-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Loader2 size={16} className="animate-spin" />
                                <span>
                                    {uploadProgress > 0 && uploadProgress < 100
                                        ? `Uploading ${uploadProgress}%`
                                        : "Wird gespeichert…"}
                                </span>
                            </div>
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="w-full bg-black/20 rounded-full h-1">
                                    <div
                                        className="bg-white h-1 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar size={16} />
                            <span>Post planen</span>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}
