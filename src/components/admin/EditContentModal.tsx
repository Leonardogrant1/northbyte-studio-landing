"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AssetDropper, AssetDropperRef } from "@/components/admin/AssetDropper";
import { Loader2, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const inputClass =
    "w-full rounded-xl bg-surface2 border border-border px-4 py-3 text-primary text-sm outline-none focus:border-accent transition-colors";

// Minimal shape of a post as returned by getRecent
export type EditablePost = {
    _id: Id<"posts">;
    title: string;
    description?: string;
    hashtags?: string[];
    videoUrl: string;
    accountId: Id<"social_accounts">;
};

interface EditContentModalProps {
    post: EditablePost;
    onClose: () => void;
}

// Extract the R2 key from a public URL, e.g. "https://cdn.example.com/videos/abc.mp4" → "videos/abc.mp4"
function extractR2Key(url: string): string | undefined {
    const match = url.match(/videos\/[^/?#]+$/);
    return match ? match[0] : undefined;
}

export function EditContentModal({ post, onClose }: EditContentModalProps) {
    const { isAuthenticated } = useConvexAuth();
    const accounts = useQuery(
        api.social_accounts.queries.getMyAccounts,
        isAuthenticated ? {} : "skip"
    );
    const updatePost = useMutation(api.posts.mutations.update);

    const [title, setTitle] = useState(post.title);
    const [description, setDescription] = useState(post.description ?? "");
    const [hashtags, setHashtags] = useState<string[]>(post.hashtags ?? []);
    const [hashtagInput, setHashtagInput] = useState("");
    const [selectedAccountId, setSelectedAccountId] = useState<Id<"social_accounts">>(post.accountId);
    const [replaceVideo, setReplaceVideo] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const assetDropperRef = useRef<AssetDropperRef>(null);

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

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Bitte einen Titel eingeben.");
            return;
        }

        setIsSaving(true);
        setUploadProgress(0);

        try {
            const videoFile = replaceVideo ? assetDropperRef.current?.getSelectedFile() : null;

            if (videoFile) {
                // Upload new video to the same R2 key (overwrite)
                const existingKey = extractR2Key(post.videoUrl);

                const presignedRes = await fetch("/api/r2/presigned-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileName: videoFile.name,
                        fileType: videoFile.type,
                        existingKey,
                    }),
                });

                if (!presignedRes.ok) throw new Error("Presigned URL konnte nicht abgerufen werden.");
                const { uploadUrl } = await presignedRes.json();

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.upload.addEventListener("progress", (e) => {
                        if (e.lengthComputable)
                            setUploadProgress(Math.round((e.loaded / e.total) * 100));
                    });
                    xhr.addEventListener("load", () =>
                        xhr.status >= 200 && xhr.status < 300
                            ? resolve()
                            : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`))
                    );
                    xhr.addEventListener("error", () =>
                        reject(new Error("Netzwerkfehler beim Upload"))
                    );
                    xhr.open("PUT", uploadUrl);
                    xhr.setRequestHeader("Content-Type", videoFile.type);
                    xhr.send(videoFile);
                });

                setUploadProgress(0);
            }

            // Patch Convex document — videoUrl stays the same (R2 key unchanged)
            await updatePost({
                id: post._id,
                title: title.trim(),
                description: description.trim() || undefined,
                hashtags: hashtags.length > 0 ? hashtags : undefined,
                accountId: selectedAccountId,
            });

            toast.success("Content erfolgreich aktualisiert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-2xl border border-border shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border sticky top-0 bg-surface z-10">
                    <h2 className="text-lg font-bold">Content bearbeiten</h2>
                    <button
                        onClick={onClose}
                        aria-label="Schließen"
                        className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface2 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6 py-6 space-y-6">
                    {/* Account selector */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">Account</h3>
                        {accounts === undefined ? (
                            <div className="flex gap-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-9 w-36 rounded-full bg-surface2 animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {accounts.map((acc) => {
                                    const selected = selectedAccountId === acc._id;
                                    return (
                                        <button
                                            key={acc._id}
                                            onClick={() => setSelectedAccountId(acc._id)}
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

                    {/* Video */}
                    <section className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">Video</h3>

                        {!replaceVideo ? (
                            <div className="relative rounded-2xl overflow-hidden border border-border bg-black">
                                <video
                                    src={post.videoUrl}
                                    controls
                                    className="w-full max-h-64 object-contain"
                                />
                                <button
                                    onClick={() => setReplaceVideo(true)}
                                    aria-label="Video ersetzen"
                                    className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/80 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    Ersetzen
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="bg-surface2 p-6 rounded-2xl border border-border flex justify-center">
                                    <AssetDropper ref={assetDropperRef} aspectRatio="16:9" />
                                </div>
                                <button
                                    onClick={() => {
                                        setReplaceVideo(false);
                                        assetDropperRef.current?.clearSelection();
                                    }}
                                    className="text-xs text-secondary hover:text-primary transition-colors"
                                >
                                    ← Bestehendes Video behalten
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Titel */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-secondary">Titel *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={inputClass}
                            disabled={isSaving}
                        />
                    </div>

                    {/* Beschreibung */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-secondary">Beschreibung / Caption</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className={inputClass + " resize-none"}
                            disabled={isSaving}
                        />
                    </div>

                    {/* Hashtags */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-secondary">Hashtags (Enter zum Hinzufügen)</label>
                        <div className="w-full rounded-xl bg-surface border border-border p-2 focus-within:border-accent transition-colors flex flex-wrap gap-2 items-center">
                            {hashtags.map((tag) => (
                                <span
                                    key={tag}
                                    className="flex items-center gap-1 bg-surface2 border border-border px-3 py-1 rounded-full text-xs text-primary"
                                >
                                    #{tag}
                                    <button
                                        onClick={() => setHashtags((h) => h.filter((t) => t !== tag))}
                                        aria-label={`#${tag} entfernen`}
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
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-end gap-3 sticky bottom-0 bg-surface">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl border border-border text-sm text-secondary hover:text-primary hover:border-primary/30 transition-colors disabled:opacity-50"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] justify-center"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                {uploadProgress > 0 && uploadProgress < 100
                                    ? `${uploadProgress}%`
                                    : "Speichern…"}
                            </>
                        ) : (
                            "Speichern"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
