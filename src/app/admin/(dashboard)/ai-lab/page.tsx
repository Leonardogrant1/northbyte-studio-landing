"use client";

import { useState, useRef, useCallback, DragEvent } from "react";
import { Plus, X, Loader2, Upload, Download, Trash2, ChevronDown, RefreshCw, ImageIcon, Film, Video } from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { AspectRatio, ImageSize } from "@/lib/nanobana";
import type { KlingTaskStatus, KlingModelName, KlingMode, KlingVgDuration, KlingVgAspectRatio, KlingVgSound, KlingVgType } from "@/lib/kling";
import { R2_BUCKETS } from "@/lib/r2-constants";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tool = "image-generation" | "motion-control" | "video-generation";

const TOOL_LABELS: Record<Tool, string> = {
    "image-generation": "Image Generation",
    "motion-control": "Motion Control",
    "video-generation": "Video Generation",
};

interface ReferenceImage {
    id: string;
    data: string;       // base64
    mimeType: string;
    preview: string;    // object URL
    name: string;
}

interface PanelState {
    id: string;
    tool: Tool;
    // Image Generation
    prompt: string;
    aspectRatio: AspectRatio;
    imageSize: ImageSize;
    referenceImages: ReferenceImage[];
    selectedAvatarId: string | null;
    result: string | null;   // dataUrl
    loading: boolean;
    // Motion Control
    mcPrompt: string;
    mcImageB64: string | null;
    mcImageMime: string | null;
    mcImagePreview: string | null;
    mcImageName: string | null;
    mcVideoUrl: string | null;
    mcVideoName: string | null;
    mcVideoUploading: boolean;
    mcVideoProgress: number;
    mcModel: KlingModelName;
    mcMode: KlingMode;
    mcKeepSound: "yes" | "no";
    mcOrientation: "video" | "image";
    mcTaskId: string | null;
    mcStatus: KlingTaskStatus | null;
    mcResultUrl: string | null;
    // Video Generation
    vgMode: KlingVgType;
    vgPrompt: string;
    vgNegativePrompt: string;
    vgModel: KlingModelName;
    vgVgMode: KlingMode;
    vgDuration: KlingVgDuration;
    vgAspectRatio: KlingVgAspectRatio;
    vgSound: KlingVgSound;
    vgImageB64: string | null;
    vgImagePreview: string | null;
    vgImageName: string | null;
    vgImageTailB64: string | null;
    vgImageTailPreview: string | null;
    vgImageTailName: string | null;
    vgTaskId: string | null;
    vgTaskType: KlingVgType | null;
    vgStatus: KlingTaskStatus | null;
    vgResultUrl: string | null;
}

function createPanel(id: string): PanelState {
    return {
        id,
        tool: "image-generation",
        prompt: "",
        aspectRatio: "9:16",
        imageSize: "2K",
        referenceImages: [],
        selectedAvatarId: null,
        result: null,
        loading: false,
        mcPrompt: "",
        mcImageB64: null,
        mcImageMime: null,
        mcImagePreview: null,
        mcImageName: null,
        mcVideoUrl: null,
        mcVideoName: null,
        mcVideoUploading: false,
        mcVideoProgress: 0,
        mcModel: "kling-v2-6",
        mcMode: "std",
        mcKeepSound: "yes",
        mcOrientation: "video",
        mcTaskId: null,
        mcStatus: null,
        mcResultUrl: null,
        vgMode: "text",
        vgPrompt: "",
        vgNegativePrompt: "",
        vgModel: "kling-v2-6",
        vgVgMode: "std",
        vgDuration: "5",
        vgAspectRatio: "9:16",
        vgSound: "on",
        vgImageB64: null,
        vgImagePreview: null,
        vgImageName: null,
        vgImageTailB64: null,
        vgImageTailPreview: null,
        vgImageTailName: null,
        vgTaskId: null,
        vgTaskType: null,
        vgStatus: null,
        vgResultUrl: null,
    };
}

let nextId = 1;
const genId = () => String(nextId++);

// ── Shared input styles ────────────────────────────────────────────────────────

const inputClass = "w-full bg-surface border border-border rounded-xl px-3 py-2 text-primary text-sm focus:outline-none focus:border-accent transition-all";
const selectClass = inputClass + " cursor-pointer";

// ── Image Generation Form ──────────────────────────────────────────────────────

function ImageGenerationForm({
    panel,
    onChange,
    onResult,
}: {
    panel: PanelState;
    onChange: (patch: Partial<PanelState>) => void;
    onResult: (dataUrl: string) => void;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [refDragging, setRefDragging] = useState(false);
    const { isAuthenticated } = useConvexAuth();
    const avatars = useQuery(api.ai_avatars.queries.getAll, isAuthenticated ? {} : "skip");

    const handleImageFiles = useCallback(async (files: FileList) => {
        const remaining = 5 - panel.referenceImages.length;
        if (remaining <= 0) { toast.error("Maximal 5 Referenzbilder erlaubt."); return; }

        const toAdd = Array.from(files).slice(0, remaining);
        const results: ReferenceImage[] = await Promise.all(
            toAdd.map(
                (file) =>
                    new Promise<ReferenceImage>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const dataUrl = reader.result as string;
                            const base64 = dataUrl.split(",")[1];
                            resolve({
                                id: genId(),
                                data: base64,
                                mimeType: file.type,
                                preview: URL.createObjectURL(file),
                                name: file.name,
                            });
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    })
            )
        );

        onChange({ referenceImages: [...panel.referenceImages, ...results] });
    }, [panel.referenceImages, onChange]);

    const removeImage = (id: string) => {
        const img = panel.referenceImages.find((i) => i.id === id);
        if (img) URL.revokeObjectURL(img.preview);
        onChange({ referenceImages: panel.referenceImages.filter((i) => i.id !== id) });
    };

    const handleGenerate = async () => {
        if (!panel.prompt.trim()) { toast.error("Bitte einen Prompt eingeben."); return; }
        onChange({ loading: true });
        try {
            const selectedAvatar = avatars?.find((a) => a._id === panel.selectedAvatarId);
            const res = await fetch("/api/ai/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: panel.prompt,
                    referenceImages: panel.referenceImages.map((i) => ({ data: i.data, mimeType: i.mimeType })),
                    avatarImageUrl: selectedAvatar?.imageUrl ?? null,
                    aspectRatio: panel.aspectRatio,
                    imageSize: panel.imageSize,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Generation failed.");
            onResult(data.dataUrl);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler bei der Generierung.");
        } finally {
            onChange({ loading: false });
        }
    };

    const handleDownload = () => {
        if (!panel.result) return;
        const a = document.createElement("a");
        a.href = panel.result;
        a.download = `nanobana-${Date.now()}.jpg`;
        a.click();
    };

    return (
        <div className="flex flex-col gap-4 h-full">
            {/* Prompt */}
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">Prompt</label>
                <textarea
                    value={panel.prompt}
                    onChange={(e) => onChange({ prompt: e.target.value })}
                    placeholder="Describe the image you want to generate…"
                    rows={4}
                    className={inputClass + " resize-none"}
                    disabled={panel.loading}
                />
            </div>

            {/* Config row */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Aspect Ratio</label>
                    <select
                        value={panel.aspectRatio}
                        onChange={(e) => onChange({ aspectRatio: e.target.value as AspectRatio })}
                        className={selectClass}
                        disabled={panel.loading}
                    >
                        {(["9:16", "16:9", "1:1", "4:3", "3:4"] as AspectRatio[]).map((r) => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Image Size</label>
                    <select
                        value={panel.imageSize}
                        onChange={(e) => onChange({ imageSize: e.target.value as ImageSize })}
                        className={selectClass}
                        disabled={panel.loading}
                    >
                        {(["1K", "2K", "4K"] as ImageSize[]).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Avatar selector */}
            {avatars && avatars.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">
                        Avatar <span className="text-secondary/60 font-normal">(optional)</span>
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {avatars.map((avatar) => {
                            const selected = panel.selectedAvatarId === avatar._id;
                            return (
                                <button
                                    key={avatar._id}
                                    type="button"
                                    onClick={() => onChange({ selectedAvatarId: selected ? null : avatar._id })}
                                    disabled={panel.loading}
                                    className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all
                                        ${selected ? "border-accent" : "border-border hover:border-accent/50"}
                                        ${panel.loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    title={avatar.name}
                                >
                                    <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                                    {selected && (
                                        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                            <div className="w-2 h-2 rounded-full bg-accent" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    {panel.selectedAvatarId && (
                        <p className="text-xs text-accent mt-1">
                            {avatars.find((a) => a._id === panel.selectedAvatarId)?.name}
                        </p>
                    )}
                </div>
            )}

            {/* Reference images */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-secondary">
                        Referenzbilder ({panel.referenceImages.length}/5)
                    </label>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
                />
                <div
                    onDragOver={(e) => { e.preventDefault(); if (panel.referenceImages.length < 5) setRefDragging(true); }}
                    onDragLeave={() => setRefDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setRefDragging(false);
                        if (e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
                    }}
                    onClick={() => !panel.loading && panel.referenceImages.length < 5 && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl transition-all p-3 min-h-[72px]
                        ${refDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
                        ${panel.loading || panel.referenceImages.length >= 5 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                    {panel.referenceImages.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {panel.referenceImages.map((img) => (
                                <div key={img.id} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                                    <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <Trash2 size={14} className="text-white" />
                                    </button>
                                </div>
                            ))}
                            {panel.referenceImages.length < 5 && (
                                <div className="w-14 h-14 rounded-lg border border-dashed border-border flex items-center justify-center shrink-0">
                                    <Upload size={14} className="text-secondary" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 h-full py-1">
                            <ImageIcon size={20} className="text-secondary" />
                            <span className="text-xs text-secondary text-center">Bilder hierher ziehen oder klicken</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Generate button */}
            <button
                onClick={handleGenerate}
                disabled={panel.loading || !panel.prompt.trim()}
                className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
                {panel.loading ? (
                    <><Loader2 size={15} className="animate-spin" /> Generiere…</>
                ) : "Generieren"}
            </button>

            {/* Result */}
            {panel.result && (
                <div className="relative rounded-xl overflow-hidden border border-border group w-fit mx-auto">
                    <img src={panel.result} alt="Generated" className="max-h-96 w-auto object-contain" />
                    <button
                        onClick={handleDownload}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Download size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Motion Control Form ────────────────────────────────────────────────────────

const STATUS_LABEL: Record<KlingTaskStatus, string> = {
    submitted: "Eingereicht…",
    processing: "Wird verarbeitet…",
    succeed: "Fertig",
    failed: "Fehlgeschlagen",
};

const STATUS_COLOR: Record<KlingTaskStatus, string> = {
    submitted: "text-yellow-400",
    processing: "text-blue-400",
    succeed: "text-green-400",
    failed: "text-red-400",
};

function MotionControlForm({
    panel,
    onChange,
}: {
    panel: PanelState;
    onChange: (patch: Partial<PanelState>) => void;
}) {
    const saveTask = useMutation(api.kling_tasks.mutations.create);
    const updateTask = useMutation(api.kling_tasks.mutations.updateStatus);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [imageDragging, setImageDragging] = useState(false);
    const [videoDragging, setVideoDragging] = useState(false);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const startPolling = (taskId: string) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/ai/motion-control/${taskId}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                onChange({ mcStatus: data.status, mcResultUrl: data.videoUrl ?? null });
                await updateTask({ taskId, status: data.status, resultUrl: data.videoUrl ?? undefined });

                if (data.status === "succeed" || data.status === "failed") {
                    stopPolling();
                    onChange({ loading: false });
                    if (data.status === "succeed") toast.success("Video fertig!");
                    else toast.error(`Task fehlgeschlagen.${data.statusMsg ? ` ${data.statusMsg}` : ""}`);
                }
            } catch {
                stopPolling();
                onChange({ loading: false, mcStatus: "failed" as KlingTaskStatus });
            }
        }, 5000);
    };

    const handleImageFile = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) { toast.error("Nur Bilddateien erlaubt."); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            const preview = URL.createObjectURL(file);
            onChange({ mcImageB64: base64, mcImageMime: file.type, mcImagePreview: preview, mcImageName: file.name });
        };
        reader.readAsDataURL(file);
    }, [onChange]);

    const handleVideoFile = useCallback(async (file: File) => {
        if (!file.type.startsWith("video/")) { toast.error("Nur Videodateien erlaubt."); return; }

        onChange({ mcVideoUploading: true, mcVideoProgress: 0, mcVideoName: file.name, mcVideoUrl: null });

        try {
            const presignRes = await fetch("/api/r2/upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bucket: R2_BUCKETS.n8n, fileName: file.name, fileType: file.type }),
            });
            if (!presignRes.ok) throw new Error("Fehler beim Generieren der Upload-URL.");
            const { uploadUrl, downloadUrl } = await presignRes.json();

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl);
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) onChange({ mcVideoProgress: Math.round((e.loaded / e.total) * 100) });
                };
                xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error(`Upload fehlgeschlagen: ${xhr.status}`));
                xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload."));
                xhr.send(file);
            });

            onChange({ mcVideoUrl: downloadUrl, mcVideoUploading: false, mcVideoProgress: 100 });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
            onChange({ mcVideoUploading: false, mcVideoProgress: 0, mcVideoName: null });
        }
    }, [onChange]);

    const handleImageDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setImageDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleImageFile(file);
    };

    const handleVideoDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setVideoDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleVideoFile(file);
    };

    const handleSubmit = async () => {
        if (!panel.mcImageB64) { toast.error("Bitte ein Bild hochladen."); return; }
        if (!panel.mcVideoUrl) { toast.error("Bitte ein Video hochladen."); return; }

        onChange({ loading: true, mcTaskId: null, mcStatus: null, mcResultUrl: null });

        try {
            const res = await fetch("/api/ai/motion-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: panel.mcPrompt,
                    image_url: panel.mcImageB64,
                    video_url: panel.mcVideoUrl,
                    model_name: panel.mcModel,
                    mode: panel.mcMode,
                    keep_original_sound: panel.mcKeepSound,
                    character_orientation: panel.mcOrientation,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const taskId: string = data.task_id;
            if (!taskId) throw new Error("Keine Task-ID in der Response.");

            onChange({ mcTaskId: taskId, mcStatus: "submitted" });

            await saveTask({
                taskId,
                prompt: panel.mcPrompt,
                imageUrl: panel.mcImageName ?? "base64-image",
                videoUrl: panel.mcVideoUrl,
            });

            startPolling(taskId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen des Tasks.");
            onChange({ loading: false });
        }
    };

    const isRunning = panel.loading && panel.mcTaskId !== null;
    const isDone = panel.mcStatus === "succeed" || panel.mcStatus === "failed";
    const disabled = panel.loading || panel.mcVideoUploading;

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">Prompt <span className="text-secondary/60 font-normal">(optional)</span></label>
                <textarea
                    value={panel.mcPrompt}
                    onChange={(e) => onChange({ mcPrompt: e.target.value })}
                    placeholder="Describe the motion to apply…"
                    rows={3}
                    className={inputClass + " resize-none"}
                    disabled={disabled}
                />
            </div>

            {/* Image dropzone */}
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">Bild</label>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
                <div
                    onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
                    onDragLeave={() => setImageDragging(false)}
                    onDrop={handleImageDrop}
                    onClick={() => !disabled && imageInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden
                        ${imageDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
                        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                        ${panel.mcImagePreview ? "p-2 flex justify-center" : "p-4 flex flex-col items-center justify-center gap-1.5 min-h-[80px]"}`}
                >
                    {panel.mcImagePreview ? (
                        <div className="relative group">
                            <img src={panel.mcImagePreview} alt={panel.mcImageName ?? ""} className="max-h-48 w-auto object-contain rounded-lg" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                <span className="text-white text-xs font-medium">Ersetzen</span>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onChange({ mcImageB64: null, mcImageMime: null, mcImagePreview: null, mcImageName: null }); }}
                                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <ImageIcon size={20} className="text-secondary" />
                            <span className="text-xs text-secondary text-center">Bild hierher ziehen oder klicken</span>
                        </>
                    )}
                </div>
            </div>

            {/* Video dropzone */}
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">Video (Referenzbewegung)</label>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])} />
                <div
                    onDragOver={(e) => { e.preventDefault(); setVideoDragging(true); }}
                    onDragLeave={() => setVideoDragging(false)}
                    onDrop={handleVideoDrop}
                    onClick={() => !disabled && videoInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl transition-all p-4 flex flex-col items-center justify-center gap-1.5 min-h-[80px] cursor-pointer
                        ${videoDragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
                        ${disabled && !panel.mcVideoUploading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                    {panel.mcVideoUploading ? (
                        <div className="w-full flex flex-col items-center gap-2">
                            <Loader2 size={18} className="animate-spin text-accent" />
                            <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden">
                                <div className="bg-accent h-full transition-all" style={{ width: `${panel.mcVideoProgress}%` }} />
                            </div>
                            <span className="text-xs text-secondary">{panel.mcVideoProgress}%</span>
                        </div>
                    ) : panel.mcVideoUrl ? (
                        <div className="flex items-center gap-2 w-full">
                            <Film size={16} className="text-green-400 shrink-0" />
                            <span className="text-xs text-primary truncate flex-1">{panel.mcVideoName}</span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onChange({ mcVideoUrl: null, mcVideoName: null, mcVideoProgress: 0 }); }}
                                className="text-secondary hover:text-primary shrink-0"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <Film size={20} className="text-secondary" />
                            <span className="text-xs text-secondary text-center">Video hierher ziehen oder klicken</span>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Modell</label>
                    <select
                        value={panel.mcModel}
                        onChange={(e) => onChange({ mcModel: e.target.value as KlingModelName })}
                        className={selectClass}
                        disabled={disabled}
                    >
                        <option value="kling-v2-6">kling-v2-6</option>
                        <option value="kling-v3">kling-v3</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Mode</label>
                    <select
                        value={panel.mcMode}
                        onChange={(e) => onChange({ mcMode: e.target.value as KlingMode })}
                        className={selectClass}
                        disabled={disabled}
                    >
                        <option value="std">Standard</option>
                        <option value="pro">Pro (High Quality)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Original Sound</label>
                    <select
                        value={panel.mcKeepSound}
                        onChange={(e) => onChange({ mcKeepSound: e.target.value as "yes" | "no" })}
                        className={selectClass}
                        disabled={disabled}
                    >
                        <option value="yes">Ja</option>
                        <option value="no">Nein</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Orientation</label>
                    <select
                        value={panel.mcOrientation}
                        onChange={(e) => onChange({ mcOrientation: e.target.value as "video" | "image" })}
                        className={selectClass}
                        disabled={disabled}
                    >
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                    </select>
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={disabled || !panel.mcImageB64 || !panel.mcVideoUrl}
                className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
                {isRunning ? (
                    <><RefreshCw size={15} className="animate-spin" /> Läuft…</>
                ) : panel.mcVideoUploading ? (
                    <><Loader2 size={15} className="animate-spin" /> Wird hochgeladen…</>
                ) : "Task erstellen"}
            </button>

            {panel.mcStatus && (
                <div className={`flex items-center gap-2 text-sm font-medium ${STATUS_COLOR[panel.mcStatus]}`}>
                    {!isDone && <Loader2 size={14} className="animate-spin" />}
                    {STATUS_LABEL[panel.mcStatus]}
                    {panel.mcTaskId && (
                        <span className="ml-auto text-xs text-secondary font-normal truncate max-w-[120px]">
                            {panel.mcTaskId}
                        </span>
                    )}
                </div>
            )}

            {panel.mcResultUrl && (
                <div className="flex justify-center">
                    <div className="relative group rounded-xl overflow-hidden border border-border">
                        <video src={panel.mcResultUrl} controls className="max-h-72 w-auto" />
                        <button
                            onClick={async () => {
                                const res = await fetch(panel.mcResultUrl!);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `kling-${Date.now()}.mp4`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Download size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Video Generation Form ──────────────────────────────────────────────────────

function VideoGenerationForm({
    panel,
    onChange,
}: {
    panel: PanelState;
    onChange: (patch: Partial<PanelState>) => void;
}) {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const imageTailInputRef = useRef<HTMLInputElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [imageDragging, setImageDragging] = useState(false);
    const [imageTailDragging, setImageTailDragging] = useState(false);

    const stopPolling = () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const startPolling = (taskId: string, type: KlingVgType) => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/ai/video-generation/${taskId}?type=${type}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                onChange({ vgStatus: data.status, vgResultUrl: data.videoUrl ?? null });

                if (data.status === "succeed" || data.status === "failed") {
                    stopPolling();
                    onChange({ loading: false });
                    if (data.status === "succeed") toast.success("Video fertig!");
                    else toast.error(`Task fehlgeschlagen.${data.statusMsg ? ` ${data.statusMsg}` : ""}`);
                }
            } catch {
                stopPolling();
                onChange({ loading: false, vgStatus: "failed" as KlingTaskStatus });
            }
        }, 5000);
    };

    const readImageFile = useCallback((file: File, target: "start" | "tail") => {
        if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
            toast.error("Nur JPG/PNG erlaubt (max 10 MB).");
            return;
        }
        if (file.size > 10 * 1024 * 1024) { toast.error("Bild max. 10 MB."); return; }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1]; // strip data: prefix
            const preview = URL.createObjectURL(file);
            if (target === "start") {
                onChange({ vgImageB64: base64, vgImagePreview: preview, vgImageName: file.name });
            } else {
                onChange({ vgImageTailB64: base64, vgImageTailPreview: preview, vgImageTailName: file.name });
            }
        };
        reader.readAsDataURL(file);
    }, [onChange]);

    const handleSubmit = async () => {
        if (panel.vgMode === "text" && !panel.vgPrompt.trim()) {
            toast.error("Bitte einen Prompt eingeben.");
            return;
        }
        if (panel.vgMode === "image" && !panel.vgImageB64 && !panel.vgImageTailB64) {
            toast.error("Bitte mindestens ein Bild hochladen.");
            return;
        }

        onChange({ loading: true, vgTaskId: null, vgStatus: null, vgResultUrl: null });

        try {
            const body: Record<string, unknown> = {
                type: panel.vgMode,
                model_name: panel.vgModel,
                mode: panel.vgVgMode,
                duration: panel.vgDuration,
                sound: panel.vgSound,
                negative_prompt: panel.vgNegativePrompt.trim() || "",
            };

            if (panel.vgMode === "text") {
                body.prompt = panel.vgPrompt.trim();
                body.aspect_ratio = panel.vgAspectRatio;
            } else {
                body.prompt = panel.vgPrompt.trim();
                if (panel.vgImageB64) body.image = panel.vgImageB64;
                if (panel.vgImageTailB64) body.image_tail = panel.vgImageTailB64;
            }

            const res = await fetch("/api/ai/video-generation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const taskId: string = data.task_id;
            if (!taskId) throw new Error("Keine Task-ID in der Response.");

            onChange({ vgTaskId: taskId, vgTaskType: panel.vgMode, vgStatus: "submitted" });
            startPolling(taskId, panel.vgMode);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen des Tasks.");
            onChange({ loading: false });
        }
    };

    const isRunning = panel.loading && panel.vgTaskId !== null;
    const isDone = panel.vgStatus === "succeed" || panel.vgStatus === "failed";
    const disabled = panel.loading;

    const ImageDropzone = ({
        label,
        b64,
        preview,
        name,
        dragging,
        onDragOver,
        onDragLeave,
        onDrop,
        onClick,
        onClear,
        optional,
    }: {
        label: string;
        b64: string | null;
        preview: string | null;
        name: string | null;
        dragging: boolean;
        onDragOver: () => void;
        onDragLeave: () => void;
        onDrop: (e: DragEvent<HTMLDivElement>) => void;
        onClick: () => void;
        onClear: () => void;
        optional?: boolean;
    }) => (
        <div>
            <label className="text-xs font-medium text-secondary block mb-1">
                {label} {optional && <span className="text-secondary/60 font-normal">(optional)</span>}
            </label>
            <div
                onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !disabled && onClick()}
                className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden
                    ${dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/50"}
                    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                    ${preview ? "p-2 flex justify-center" : "p-4 flex flex-col items-center justify-center gap-1.5 min-h-[80px]"}`}
            >
                {preview ? (
                    <div className="relative group">
                        <img src={preview} alt={name ?? ""} className="max-h-40 w-auto object-contain rounded-lg" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                            <span className="text-white text-xs font-medium">Ersetzen</span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-md p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <>
                        <ImageIcon size={20} className="text-secondary" />
                        <span className="text-xs text-secondary text-center">Bild hierher ziehen oder klicken</span>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            {/* Mode toggle */}
            <div className="flex rounded-xl overflow-hidden border border-border">
                {(["text", "image"] as KlingVgType[]).map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => onChange({ vgMode: m })}
                        disabled={disabled}
                        className={`flex-1 py-1.5 text-xs font-medium transition-all
                            ${panel.vgMode === m ? "bg-accent text-background" : "bg-surface text-secondary hover:text-primary"}
                            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        {m === "text" ? "Text → Video" : "Image → Video"}
                    </button>
                ))}
            </div>

            {/* Prompt */}
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">
                    Prompt {panel.vgMode === "image" && <span className="text-secondary/60 font-normal">(optional)</span>}
                </label>
                <textarea
                    value={panel.vgPrompt}
                    onChange={(e) => onChange({ vgPrompt: e.target.value })}
                    placeholder="Describe the video you want to generate…"
                    rows={3}
                    className={inputClass + " resize-none"}
                    disabled={disabled}
                />
            </div>

            {/* Negative prompt */}
            <div>
                <label className="text-xs font-medium text-secondary block mb-1">
                    Negative Prompt <span className="text-secondary/60 font-normal">(optional)</span>
                </label>
                <input
                    type="text"
                    value={panel.vgNegativePrompt}
                    onChange={(e) => onChange({ vgNegativePrompt: e.target.value })}
                    placeholder="What to avoid…"
                    className={inputClass}
                    disabled={disabled}
                />
            </div>

            {/* Image dropzones (image mode only) */}
            {panel.vgMode === "image" && (
                <>
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden"
                        onChange={(e) => e.target.files?.[0] && readImageFile(e.target.files[0], "start")} />
                    <input ref={imageTailInputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden"
                        onChange={(e) => e.target.files?.[0] && readImageFile(e.target.files[0], "tail")} />

                    <ImageDropzone
                        label="Start-Frame"
                        b64={panel.vgImageB64}
                        preview={panel.vgImagePreview}
                        name={panel.vgImageName}
                        dragging={imageDragging}
                        onDragOver={() => setImageDragging(true)}
                        onDragLeave={() => setImageDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setImageDragging(false); const f = e.dataTransfer.files[0]; if (f) readImageFile(f, "start"); }}
                        onClick={() => imageInputRef.current?.click()}
                        onClear={() => { if (panel.vgImagePreview) URL.revokeObjectURL(panel.vgImagePreview); onChange({ vgImageB64: null, vgImagePreview: null, vgImageName: null }); }}
                    />
                    <ImageDropzone
                        label="End-Frame"
                        b64={panel.vgImageTailB64}
                        preview={panel.vgImageTailPreview}
                        name={panel.vgImageTailName}
                        dragging={imageTailDragging}
                        onDragOver={() => setImageTailDragging(true)}
                        onDragLeave={() => setImageTailDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setImageTailDragging(false); const f = e.dataTransfer.files[0]; if (f) readImageFile(f, "tail"); }}
                        onClick={() => imageTailInputRef.current?.click()}
                        onClear={() => { if (panel.vgImageTailPreview) URL.revokeObjectURL(panel.vgImageTailPreview); onChange({ vgImageTailB64: null, vgImageTailPreview: null, vgImageTailName: null }); }}
                        optional
                    />
                </>
            )}

            {/* Config grid */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Modell</label>
                    <select value={panel.vgModel} onChange={(e) => onChange({ vgModel: e.target.value as KlingModelName })} className={selectClass} disabled={disabled}>
                        <option value="kling-v2-6">kling-v2-6</option>
                        <option value="kling-v3">kling-v3</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Mode</label>
                    <select value={panel.vgVgMode} onChange={(e) => onChange({ vgVgMode: e.target.value as KlingMode })} className={selectClass} disabled={disabled}>
                        <option value="std">Standard</option>
                        <option value="pro">Pro</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Dauer</label>
                    <select value={panel.vgDuration} onChange={(e) => onChange({ vgDuration: e.target.value as KlingVgDuration })} className={selectClass} disabled={disabled}>
                        <option value="5">5 Sekunden</option>
                        <option value="10">10 Sekunden</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Sound</label>
                    <select value={panel.vgSound} onChange={(e) => onChange({ vgSound: e.target.value as KlingVgSound })} className={selectClass} disabled={disabled}>
                        <option value="on">An</option>
                        <option value="off">Aus</option>
                    </select>
                </div>
            </div>

            {/* Aspect ratio (text mode only) */}
            {panel.vgMode === "text" && (
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Seitenverhältnis</label>
                    <select value={panel.vgAspectRatio} onChange={(e) => onChange({ vgAspectRatio: e.target.value as KlingVgAspectRatio })} className={selectClass} disabled={disabled}>
                        {(["9:16", "16:9", "1:1"] as KlingVgAspectRatio[]).map((r) => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={disabled || (panel.vgMode === "text" && !panel.vgPrompt.trim()) || (panel.vgMode === "image" && !panel.vgImageB64 && !panel.vgImageTailB64)}
                className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
                {isRunning ? (
                    <><RefreshCw size={15} className="animate-spin" /> Läuft…</>
                ) : "Video generieren"}
            </button>

            {/* Status */}
            {panel.vgStatus && (
                <div className={`flex items-center gap-2 text-sm font-medium ${STATUS_COLOR[panel.vgStatus]}`}>
                    {!isDone && <Loader2 size={14} className="animate-spin" />}
                    {STATUS_LABEL[panel.vgStatus]}
                    {panel.vgTaskId && (
                        <span className="ml-auto text-xs text-secondary font-normal truncate max-w-[120px]">
                            {panel.vgTaskId}
                        </span>
                    )}
                </div>
            )}

            {/* Result */}
            {panel.vgResultUrl && (
                <div className="flex justify-center">
                    <div className="relative group rounded-xl overflow-hidden border border-border">
                        <video src={panel.vgResultUrl} controls className="max-h-72 w-auto" />
                        <button
                            onClick={async () => {
                                const res = await fetch(panel.vgResultUrl!);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `kling-vg-${Date.now()}.mp4`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Download size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Panel ──────────────────────────────────────────────────────────────────────

function Panel({
    panel,
    canClose,
    onChange,
    onClose,
}: {
    panel: PanelState;
    canClose: boolean;
    onChange: (patch: Partial<PanelState>) => void;
    onClose: () => void;
}) {
    return (
        <div className="flex flex-col bg-surface2 border border-border rounded-2xl overflow-hidden min-w-0 flex-1">
            {/* Panel header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className="relative flex-1">
                    <select
                        value={panel.tool}
                        onChange={(e) => onChange({ tool: e.target.value as Tool, result: null })}
                        className="w-full appearance-none bg-surface border border-border rounded-xl pl-3 pr-8 py-1.5 text-sm font-medium text-primary focus:outline-none focus:border-accent transition-all cursor-pointer"
                    >
                        {(Object.keys(TOOL_LABELS) as Tool[]).map((t) => (
                            <option key={t} value={t}>{TOOL_LABELS[t]}</option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
                </div>
                {canClose && (
                    <button
                        onClick={onClose}
                        className="text-secondary hover:text-primary transition-colors shrink-0"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
                {panel.tool === "image-generation" ? (
                    <ImageGenerationForm
                        panel={panel}
                        onChange={onChange}
                        onResult={(dataUrl) => onChange({ result: dataUrl })}
                    />
                ) : panel.tool === "motion-control" ? (
                    <MotionControlForm panel={panel} onChange={onChange} />
                ) : (
                    <VideoGenerationForm panel={panel} onChange={onChange} />
                )}
            </div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AILabPage() {
    const [panels, setPanels] = useState<PanelState[]>([createPanel(genId())]);

    const addPanel = () => {
        if (panels.length >= 3) return;
        setPanels((p) => [...p, createPanel(genId())]);
    };

    const removePanel = (id: string) => {
        setPanels((p) => p.filter((panel) => panel.id !== id));
    };

    const updatePanel = (id: string, patch: Partial<PanelState>) => {
        setPanels((p) => p.map((panel) => panel.id === id ? { ...panel, ...patch } : panel));
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-3xl font-bold mb-1">AI Lab</h1>
                    <p className="text-secondary text-sm">Generiere und bearbeite Inhalte mit KI-Tools.</p>
                </div>
                {panels.length < 3 && (
                    <button
                        onClick={addPanel}
                        className="flex items-center gap-2 px-4 py-2 bg-surface2 border border-border text-sm font-medium text-primary rounded-xl hover:border-accent/50 transition-all"
                    >
                        <Plus size={15} />
                        Panel hinzufügen
                    </button>
                )}
            </div>

            <div className={`flex gap-4 flex-1 min-h-0 ${panels.length === 1 ? "max-w-lg" : ""}`}>
                {panels.map((panel) => (
                    <Panel
                        key={panel.id}
                        panel={panel}
                        canClose={panels.length > 1}
                        onChange={(patch) => updatePanel(panel.id, patch)}
                        onClose={() => removePanel(panel.id)}
                    />
                ))}
            </div>
        </div>
    );
}
