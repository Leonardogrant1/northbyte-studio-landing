"use client";

import { X, Download, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "@repo/backend/convex/_generated/api";
import { toast } from "sonner";
import { MediaItem } from "./MediaCard";

const GENDER_LABELS = { male: "Männlich", female: "Weiblich", diverse: "Divers" };
const SKIN_LABELS: Record<string, string> = { white: "White", black: "Black", "light-skin": "Light-Skin", asian: "Asian", indian: "Indian", brown: "Brown" };

interface MediaModalProps {
    item: MediaItem | null;
    appName?: string;
    avatarName?: string;
    onClose: () => void;
    onDeleted: () => void;
}

export function MediaModal({ item, appName, avatarName, onClose, onDeleted }: MediaModalProps) {
    const user = useCurrentUser();
    const deleteMedia = useMutation(api.media.mutations.deleteMedia);

    const canDelete = user && item && (
        user._id === item.uploadedBy || user.type === "admin"
    );

    const handleDelete = async () => {
        if (!item) return;
        if (!confirm("Dieses Medium wirklich löschen?")) return;
        try {
            await deleteMedia({ mediaId: item._id });
            toast.success("Medium gelöscht.");
            onDeleted();
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
        }
    };

    const handleDownload = () => {
        if (!item) return;
        const a = document.createElement("a");
        a.href = item.fileUrl;
        a.download = item.title;
        a.target = "_blank";
        a.click();
    };

    return (
        <AnimatePresence>
            {item && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="relative bg-surface2 rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors"
                        >
                            <X size={16} className="text-white" />
                        </button>

                        {/* Media */}
                        <div className="bg-black" style={{ aspectRatio: "9/16" }}>
                            {item.type === "video" ? (
                                <video
                                    key={item._id}
                                    src={item.fileUrl}
                                    controls
                                    autoPlay
                                    loop
                                    playsInline
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <img
                                    src={item.fileUrl}
                                    alt={item.title}
                                    className="w-full h-full object-contain"
                                />
                            )}
                        </div>

                        {/* Info + Actions */}
                        <div className="p-4 space-y-3">
                            <h3 className="font-semibold text-primary">{item.title}</h3>

                            <div className="flex flex-wrap gap-2">
                                {appName && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
                                        {appName}
                                    </span>
                                )}
                                {avatarName && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
                                        {avatarName}
                                    </span>
                                )}
                                {item.contentType && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface2 border border-border text-secondary">
                                        {item.contentType === "creator" ? "Creator" : "Demo"}
                                    </span>
                                )}
                                {item.gender && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface2 border border-border text-secondary">
                                        {GENDER_LABELS[item.gender]}
                                    </span>
                                )}
                                {item.skinTone && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface2 border border-border text-secondary">
                                        {SKIN_LABELS[item.skinTone]}
                                    </span>
                                )}
                                {item.language && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-surface2 border border-border text-secondary uppercase">
                                        {item.language}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={handleDownload}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent text-background font-medium rounded-xl hover:opacity-90 transition-all text-sm"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                                {canDelete && (
                                    <button
                                        onClick={handleDelete}
                                        className="flex items-center justify-center gap-2 px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
