"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Download, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";

const NORTHBYTE_BUCKET = "northbyte-media";

interface UserAttachmentsModalProps {
    userId: Id<"users">;
    userEmail: string;
    onClose: () => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UserAttachmentsModal({ userId, userEmail, onClose }: UserAttachmentsModalProps) {
    const attachments = useQuery(api.user_attachments.queries.getByUserId, { userId });
    const createAttachment = useMutation(api.user_attachments.mutations.create);
    const removeAttachment = useMutation(api.user_attachments.mutations.remove);

    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    const [deletingId, setDeletingId] = useState<Id<"user_attachments"> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = async (file: File) => {
        if (!file.type) {
            toast.error("Dateityp konnte nicht erkannt werden.");
            return;
        }
        setUploading(true);
        setProgress(0);
        try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const key = `user-attachments/${userId}/${Date.now()}-${safeName}`;

            const res = await fetch("/api/r2/upload-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bucket: NORTHBYTE_BUCKET,
                    fileName: file.name,
                    fileType: file.type,
                    key,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? "Upload-URL konnte nicht erstellt werden.");
            }
            const { uploadUrl, downloadUrl } = (await res.json()) as {
                uploadUrl: string;
                downloadUrl: string;
            };

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl);
                // Muss dem fileType aus der Signatur entsprechen, sonst lehnt R2 ab
                xhr.setRequestHeader("Content-Type", file.type);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
                };
                xhr.onload = () =>
                    xhr.status >= 200 && xhr.status < 300
                        ? resolve()
                        : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
                xhr.onerror = () => reject(new Error("Upload fehlgeschlagen."));
                xhr.send(file);
            });

            // Erst nach erfolgreichem R2-Upload — kein verwaister DB-Eintrag
            await createAttachment({
                userId,
                fileName: file.name,
                fileKey: key,
                fileUrl: downloadUrl,
                fileType: file.type,
                fileSize: file.size,
            });
            toast.success(`${file.name} hochgeladen.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Hochladen.");
        } finally {
            setUploading(false);
            setProgress(0);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDelete = async (
        attachmentId: Id<"user_attachments">,
        fileKey: string,
        fileName: string
    ) => {
        if (!window.confirm(`„${fileName}" wirklich löschen?`)) return;
        setDeletingId(attachmentId);
        try {
            // R2 zuerst; schlägt es fehl, wird der DB-Eintrag trotzdem entfernt
            const r2Res = await fetch("/api/r2/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bucket: NORTHBYTE_BUCKET, key: fileKey }),
            }).catch(() => null);

            await removeAttachment({ attachmentId });

            if (!r2Res || !r2Res.ok) {
                toast.warning("Eintrag gelöscht, aber die Datei konnte in R2 nicht entfernt werden.");
            } else {
                toast.success("Datei gelöscht.");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold">Anhänge</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-sm text-secondary mb-5">{userEmail}</p>

                {/* Upload-Zone */}
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files[0];
                        if (file && !uploading) uploadFile(file);
                    }}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer transition-all mb-5 ${
                        dragOver
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-accent/50"
                    } ${uploading ? "opacity-70 cursor-default" : ""}`}
                >
                    {uploading ? (
                        <>
                            <Loader2 size={20} className="animate-spin text-accent" />
                            <span className="text-sm text-secondary">Wird hochgeladen… {progress}%</span>
                            <div className="w-full max-w-xs h-1.5 bg-border rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-accent transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <Upload size={20} className="text-secondary" />
                            <span className="text-sm text-secondary">
                                Datei hierher ziehen oder klicken (PDF, Bilder, Dokumente)
                            </span>
                        </>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(file);
                        }}
                    />
                </div>

                {/* Dateiliste */}
                {attachments === undefined ? (
                    <div className="flex items-center gap-2 text-secondary text-sm py-4">
                        <Loader2 size={14} className="animate-spin" /> Wird geladen…
                    </div>
                ) : attachments.length === 0 ? (
                    <p className="text-secondary text-sm py-2">Keine Anhänge vorhanden.</p>
                ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                        {attachments.map((a) => (
                            <div
                                key={a._id}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-surface2/80 transition-colors"
                            >
                                <FileText size={18} className="text-accent shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-primary truncate" title={a.fileName}>
                                        {a.fileName}
                                    </p>
                                    <p className="text-xs text-secondary">
                                        {formatFileSize(a.fileSize)} · {formatDate(a.uploadedAt)}
                                    </p>
                                </div>
                                <a
                                    href={a.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-secondary hover:text-accent transition-colors p-1"
                                    title="Herunterladen"
                                >
                                    <Download size={16} />
                                </a>
                                <button
                                    onClick={() => handleDelete(a._id, a.fileKey, a.fileName)}
                                    disabled={deletingId === a._id}
                                    className="text-secondary hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                                    title="Löschen"
                                >
                                    {deletingId === a._id ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
