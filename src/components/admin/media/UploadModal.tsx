"use client";

import { useState, useRef, useCallback } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";

const ACCEPTED = "video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp";

async function extractFirstFrame(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;

        const cleanup = () => URL.revokeObjectURL(objectUrl);

        video.addEventListener("seeked", () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 720;
            canvas.height = video.videoHeight || 1280;
            const ctx = canvas.getContext("2d");
            if (!ctx) { cleanup(); reject(new Error("Canvas not available")); return; }
            ctx.drawImage(video, 0, 0);
            cleanup();
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Failed to extract frame"));
            }, "image/jpeg", 0.85);
        }, { once: true });

        video.addEventListener("loadeddata", () => {
            video.currentTime = 0.01;
        }, { once: true });

        video.addEventListener("error", () => {
            cleanup();
            reject(new Error("Failed to load video for thumbnail extraction"));
        }, { once: true });

        video.load();
    });
}

async function uploadToR2(file: File | Blob, filename: string, fileType: string): Promise<string> {
    // Step 1: Get presigned URL from our API
    const res = await fetch("/api/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: filename, fileType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to get upload URL");

    // Step 2: Upload directly to R2 (bypasses Next.js body size limit)
    const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": fileType },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload to R2");

    return data.fileUrl;
}

interface UploadModalProps {
    onClose: () => void;
    onUploaded: () => void;
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
    const apps = useQuery(api.apps.queries.getAll);
    const avatars = useQuery(api.ai_avatars.queries.getAll);
    const createMedia = useMutation(api.media.mutations.createMedia);

    const [file, setFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
    const [title, setTitle] = useState("");
    const [appId, setAppId] = useState<Id<"apps"> | "">("");
    const [avatarId, setAvatarId] = useState<Id<"ai_avatars"> | "">("");
    const [contentType, setContentType] = useState<"" | "creator" | "demo">("");
    const [gender, setGender] = useState<"" | "male" | "female" | "diverse">("");
    const [skinTone, setSkinTone] = useState<"" | "white" | "black" | "light-skin" | "asian" | "indian" | "brown">("");
    const [language, setLanguage] = useState("");
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (selected: File) => {
        setFile(selected);
        setTitle(selected.name.replace(/\.[^/.]+$/, ""));

        if (selected.type.startsWith("video/")) {
            setExtracting(true);
            try {
                const blob = await extractFirstFrame(selected);
                setThumbnailBlob(blob);
                setThumbnailPreview(URL.createObjectURL(blob));
            } catch {
                toast.error("Thumbnail-Extraktion fehlgeschlagen — bitte ein anderes Video versuchen.");
            } finally {
                setExtracting(false);
            }
        } else {
            // Image: use itself as thumbnail
            setThumbnailBlob(selected);
            setThumbnailPreview(URL.createObjectURL(selected));
        }
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !thumbnailBlob) return;

        setLoading(true);
        try {
            const type = file.type.startsWith("video/") ? "video" : "image";
            const timestamp = Date.now();

            const [fileUrl, thumbnailUrl] = await Promise.all([
                uploadToR2(file, `media-${timestamp}-${file.name}`, file.type),
                uploadToR2(thumbnailBlob, `thumb-${timestamp}.jpg`, "image/jpeg"),
            ]);

            await createMedia({
                title: title.trim(),
                type,
                fileUrl,
                thumbnailUrl,
                appId: appId ? (appId as Id<"apps">) : undefined,
                avatarId: avatarId ? (avatarId as Id<"ai_avatars">) : undefined,
                contentType: contentType || undefined,
                gender: gender || undefined,
                skinTone: skinTone || undefined,
                language: language || undefined,
            });

            toast.success("Medium erfolgreich hochgeladen.");
            onUploaded();
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50";
    const selectClass = inputClass;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3 }}
                    className="bg-surface2/95 border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-5 border-b border-border">
                        <h2 className="text-lg font-semibold">Medium hochladen</h2>
                        <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {/* Drop zone */}
                        {!file ? (
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                                    dragOver ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
                                }`}
                                onClick={() => inputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <Upload size={32} className="mx-auto mb-3 text-secondary" />
                                <p className="text-sm text-secondary">Video oder Bild hier ablegen</p>
                                <p className="text-xs text-secondary/60 mt-1">MP4, MOV, WEBM, JPG, PNG, WEBP</p>
                            </div>
                        ) : (
                            <div className="flex gap-3 items-start">
                                <div className="relative w-20 h-36 rounded-lg overflow-hidden bg-black shrink-0">
                                    {extracting ? (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Loader2 size={20} className="text-white animate-spin" />
                                        </div>
                                    ) : thumbnailPreview ? (
                                        <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-full object-cover" />
                                    ) : null}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-primary truncate">{file.name}</p>
                                    <p className="text-xs text-secondary mt-0.5">
                                        {(file.size / 1024 / 1024).toFixed(1)} MB
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => { setFile(null); setThumbnailPreview(null); setThumbnailBlob(null); }}
                                        className="text-xs text-red-400 hover:underline mt-2"
                                    >
                                        Entfernen
                                    </button>
                                </div>
                            </div>
                        )}

                        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                        {/* Fields */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-secondary block mb-1">Titel *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    placeholder="z.B. Creator Video DE Sommer"
                                    className={inputClass}
                                    disabled={loading}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-secondary block mb-1">Content-Typ</label>
                                <select
                                    value={contentType}
                                    onChange={(e) => setContentType(e.target.value as typeof contentType)}
                                    className={selectClass}
                                    disabled={loading}
                                >
                                    <option value="">Keine Angabe</option>
                                    <option value="creator">Creator — Person sichtbar</option>
                                    <option value="demo">Demo — Hände / App</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-secondary block mb-1">App</label>
                                    <select
                                        value={appId}
                                        onChange={(e) => setAppId(e.target.value as Id<"apps"> | "")}
                                        className={selectClass}
                                        disabled={loading}
                                    >
                                        <option value="">Keine App</option>
                                        {apps?.map((app) => (
                                            <option key={app._id} value={app._id}>{app.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-secondary block mb-1">AI Avatar</label>
                                    <select
                                        value={avatarId}
                                        onChange={(e) => setAvatarId(e.target.value as Id<"ai_avatars"> | "")}
                                        className={selectClass}
                                        disabled={loading}
                                    >
                                        <option value="">Kein Avatar</option>
                                        {avatars?.map((a) => (
                                            <option key={a._id} value={a._id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-secondary block mb-1">Geschlecht</label>
                                    <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={selectClass} disabled={loading}>
                                        <option value="">Keine Angabe</option>
                                        <option value="male">Männlich</option>
                                        <option value="female">Weiblich</option>
                                        <option value="diverse">Divers</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-secondary block mb-1">Hautton</label>
                                    <select value={skinTone} onChange={(e) => setSkinTone(e.target.value as typeof skinTone)} className={selectClass} disabled={loading}>
                                        <option value="">Keine Angabe</option>
                                        <option value="white">White</option>
                                        <option value="black">Black</option>
                                        <option value="light-skin">Light-Skin</option>
                                        <option value="asian">Asian</option>
                                        <option value="indian">Indian</option>
                                        <option value="brown">Brown</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-secondary block mb-1">Sprache</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className={selectClass}
                                    disabled={loading}
                                >
                                    <option value="">Keine Angabe</option>
                                    <option value="de">Deutsch</option>
                                    <option value="en">Englisch</option>
                                    <option value="es">Spanisch</option>
                                    <option value="pt">Portugiesisch</option>
                                    <option value="fr">Französisch</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || extracting || !file || !title.trim()}
                            className="w-full py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <><Loader2 size={16} className="animate-spin" /> Wird hochgeladen…</>
                            ) : "Hochladen"}
                        </button>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
