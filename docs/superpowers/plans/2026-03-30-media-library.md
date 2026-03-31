# Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a media library page where admins and creators can upload, label, and browse video/image assets stored on Cloudflare R2 via Vercel Blob.

**Architecture:** Assets (video/image + JPEG thumbnail) are uploaded to Vercel Blob via a Next.js API route. Thumbnails for videos are extracted client-side using the Canvas API. Metadata is stored in a new Convex `media` table. The UI is a filterable 9:16 grid — hover reveals an expand icon, click opens a viewer modal.

**Tech Stack:** Next.js App Router, Convex, Vercel Blob (`@vercel/blob`), Tailwind CSS, Framer Motion, Lucide React, `convex/react`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `convex/schema.ts` | Add `media` table |
| Create | `convex/media/queries.ts` | `getAll` with optional filters |
| Create | `convex/media/mutations.ts` | `createMedia`, `deleteMedia` |
| Create | `src/app/api/upload-media/route.ts` | Vercel Blob upload for video + image |
| Create | `src/components/admin/media/MediaCard.tsx` | Single 9:16 grid card with hover expand |
| Create | `src/components/admin/media/MediaModal.tsx` | Full-screen viewer modal |
| Create | `src/components/admin/media/UploadModal.tsx` | Upload form + canvas thumbnail extraction |
| Create | `src/components/admin/media/MediaGrid.tsx` | Filter bar + responsive grid |
| Modify | `src/app/admin/(dashboard)/media/page.tsx` | Wire everything together |

---

## Task 1: Add `media` Table to Convex Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the `media` table**

Add the following table definition inside `defineSchema({...})` in `convex/schema.ts`, after the `user_invites` table:

```typescript
    media: defineTable({
        title: v.string(),
        type: v.union(v.literal("video"), v.literal("image")),
        fileUrl: v.string(),
        thumbnailUrl: v.string(),
        appId: v.id("apps"),
        gender: v.optional(v.union(
            v.literal("male"),
            v.literal("female"),
            v.literal("diverse")
        )),
        skinTone: v.optional(v.union(
            v.literal("light"),
            v.literal("medium"),
            v.literal("dark")
        )),
        language: v.optional(v.string()),
        uploadedBy: v.id("users"),
        createdAt: v.number(),
    })
        .index("by_app", ["appId"])
        .index("by_type", ["type"])
        .index("by_uploader", ["uploadedBy"]),
```

- [ ] **Step 2: Verify `npx convex dev` is running**

The Convex dev server must be running to push the schema and regenerate `_generated/` types. Check your terminal. If not running, start it — but do not wait for it in this task.

> **Note:** Run all commands from `/Users/leonardogranetto/Projects/northbyte_studio`

---

## Task 2: Convex Media Backend

**Files:**
- Create: `convex/media/queries.ts`
- Create: `convex/media/mutations.ts`

- [ ] **Step 1: Create `convex/media/queries.ts`**

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAll = query({
    args: {
        appId: v.optional(v.id("apps")),
        type: v.optional(v.union(v.literal("video"), v.literal("image"))),
        gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("diverse"))),
        skinTone: v.optional(v.union(v.literal("light"), v.literal("medium"), v.literal("dark"))),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        let items = args.appId
            ? await ctx.db
                .query("media")
                .withIndex("by_app", (q) => q.eq("appId", args.appId!))
                .collect()
            : await ctx.db.query("media").collect();

        if (args.type) items = items.filter((i) => i.type === args.type);
        if (args.gender) items = items.filter((i) => i.gender === args.gender);
        if (args.skinTone) items = items.filter((i) => i.skinTone === args.skinTone);
        if (args.language) items = items.filter((i) => i.language === args.language);

        return items.sort((a, b) => b.createdAt - a.createdAt);
    },
});
```

- [ ] **Step 2: Create `convex/media/mutations.ts`**

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createMedia = mutation({
    args: {
        title: v.string(),
        type: v.union(v.literal("video"), v.literal("image")),
        fileUrl: v.string(),
        thumbnailUrl: v.string(),
        appId: v.id("apps"),
        gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("diverse"))),
        skinTone: v.optional(v.union(v.literal("light"), v.literal("medium"), v.literal("dark"))),
        language: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        return await ctx.db.insert("media", {
            ...args,
            uploadedBy: user._id,
            createdAt: Date.now(),
        });
    },
});

export const deleteMedia = mutation({
    args: { mediaId: v.id("media") },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        const item = await ctx.db.get(args.mediaId);
        if (!item) throw new Error("Media not found.");

        const isOwner = item.uploadedBy === user._id;
        const isAdmin = user.type === "admin";
        if (!isOwner && !isAdmin) throw new Error("Not authorized to delete this media.");

        await ctx.db.delete(args.mediaId);
    },
});
```

---

## Task 3: Upload-Media API Route

**Files:**
- Create: `src/app/api/upload-media/route.ts`

- [ ] **Step 1: Create `src/app/api/upload-media/route.ts`**

This is based on the existing `src/app/api/upload-video/route.ts` but accepts both video and image files:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

const ACCEPTED_TYPES = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "image/jpeg",
    "image/png",
    "image/webp",
];

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ACCEPTED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: `Unsupported file type: ${file.type}` },
                { status: 400 }
            );
        }

        const blob = await put(file.name, file, {
            access: "public",
            addRandomSuffix: true,
        });

        return NextResponse.json({ success: true, url: blob.url }, { status: 200 });
    } catch (error) {
        console.error("Error uploading to R2:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
```

---

## Task 4: MediaCard Component

**Files:**
- Create: `src/components/admin/media/MediaCard.tsx`

- [ ] **Step 1: Create `src/components/admin/media/MediaCard.tsx`**

```typescript
"use client";

import { useState } from "react";
import { Expand, Video } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

export interface MediaItem {
    _id: Id<"media">;
    title: string;
    type: "video" | "image";
    fileUrl: string;
    thumbnailUrl: string;
    appId: Id<"apps">;
    gender?: "male" | "female" | "diverse";
    skinTone?: "light" | "medium" | "dark";
    language?: string;
    uploadedBy: Id<"users">;
    createdAt: number;
}

interface MediaCardProps {
    item: MediaItem;
    onClick: () => void;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="relative rounded-xl overflow-hidden cursor-pointer bg-surface2 group"
            style={{ aspectRatio: "9/16" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
            />

            {item.type === "video" && (
                <div className="absolute top-2 left-2">
                    <div className="bg-black/60 backdrop-blur-sm rounded-md p-1">
                        <Video size={12} className="text-white" />
                    </div>
                </div>
            )}

            {hovered && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                        <Expand size={22} className="text-white" />
                    </div>
                </div>
            )}

            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-medium truncate">{item.title}</p>
            </div>
        </div>
    );
}
```

---

## Task 5: MediaModal Component

**Files:**
- Create: `src/components/admin/media/MediaModal.tsx`

- [ ] **Step 1: Create `src/components/admin/media/MediaModal.tsx`**

```typescript
"use client";

import { X, Download, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "../../../../convex/_generated/api";
import { toast } from "sonner";
import { MediaItem } from "./MediaCard";

const GENDER_LABELS = { male: "Männlich", female: "Weiblich", diverse: "Divers" };
const SKIN_LABELS = { light: "Hell", medium: "Mittel", dark: "Dunkel" };

interface MediaModalProps {
    item: MediaItem | null;
    appName: string;
    onClose: () => void;
    onDeleted: () => void;
}

export function MediaModal({ item, appName, onClose, onDeleted }: MediaModalProps) {
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
                                <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent">
                                    {appName}
                                </span>
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
```

---

## Task 6: UploadModal Component

**Files:**
- Create: `src/components/admin/media/UploadModal.tsx`

This is the most complex component. It handles file selection, client-side first-frame extraction for videos, live thumbnail preview, form fields, and the two-step upload (file + thumbnail to Vercel Blob, then Convex mutation).

- [ ] **Step 1: Create `src/components/admin/media/UploadModal.tsx`**

```typescript
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

async function uploadToBlob(file: File | Blob, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file, filename);
    const res = await fetch("/api/upload-media", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.url;
}

interface UploadModalProps {
    onClose: () => void;
    onUploaded: () => void;
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
    const apps = useQuery(api.apps.queries.getAll);
    const createMedia = useMutation(api.media.mutations.createMedia);

    const [file, setFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
    const [title, setTitle] = useState("");
    const [appId, setAppId] = useState<Id<"apps"> | "">("");
    const [gender, setGender] = useState<"" | "male" | "female" | "diverse">("");
    const [skinTone, setSkinTone] = useState<"" | "light" | "medium" | "dark">("");
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
        if (!file || !thumbnailBlob || !appId) return;

        setLoading(true);
        try {
            const type = file.type.startsWith("video/") ? "video" : "image";
            const timestamp = Date.now();

            const [fileUrl, thumbnailUrl] = await Promise.all([
                uploadToBlob(file, `media-${timestamp}-${file.name}`),
                uploadToBlob(thumbnailBlob, `thumb-${timestamp}.jpg`),
            ]);

            await createMedia({
                title: title.trim(),
                type,
                fileUrl,
                thumbnailUrl,
                appId: appId as Id<"apps">,
                gender: gender || undefined,
                skinTone: skinTone || undefined,
                language: language.trim() || undefined,
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
                                <label className="text-xs font-medium text-secondary block mb-1">App *</label>
                                <select
                                    value={appId}
                                    onChange={(e) => setAppId(e.target.value as Id<"apps"> | "")}
                                    required
                                    className={selectClass}
                                    disabled={loading}
                                >
                                    <option value="">App auswählen…</option>
                                    {apps?.map((app) => (
                                        <option key={app._id} value={app._id}>{app.name}</option>
                                    ))}
                                </select>
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
                                        <option value="light">Hell</option>
                                        <option value="medium">Mittel</option>
                                        <option value="dark">Dunkel</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-secondary block mb-1">Sprache</label>
                                <input
                                    type="text"
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    placeholder="de, en, es…"
                                    maxLength={10}
                                    className={inputClass}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || extracting || !file || !appId || !title.trim()}
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
```

---

## Task 7: MediaGrid Component

**Files:**
- Create: `src/components/admin/media/MediaGrid.tsx`

- [ ] **Step 1: Create `src/components/admin/media/MediaGrid.tsx`**

```typescript
"use client";

import { Upload } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { MediaCard, MediaItem } from "./MediaCard";

interface App {
    _id: Id<"apps">;
    name: string;
}

interface Filters {
    appId: Id<"apps"> | "";
    type: "video" | "image" | "";
    gender: "male" | "female" | "diverse" | "";
    skinTone: "light" | "medium" | "dark" | "";
    language: string;
}

interface MediaGridProps {
    items: MediaItem[] | undefined;
    apps: App[] | undefined;
    filters: Filters;
    onFilterChange: (filters: Partial<Filters>) => void;
    onCardClick: (item: MediaItem) => void;
    onUploadClick: () => void;
}

const pillBase = "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer";
const pillActive = "bg-accent text-background";
const pillInactive = "bg-surface2 border border-border text-secondary hover:border-accent/50";

export function MediaGrid({ items, apps, filters, onFilterChange, onCardClick, onUploadClick }: MediaGridProps) {
    return (
        <div className="space-y-5">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* App filter */}
                <select
                    value={filters.appId}
                    onChange={(e) => onFilterChange({ appId: e.target.value as Id<"apps"> | "" })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Apps</option>
                    {apps?.map((app) => (
                        <option key={app._id} value={app._id}>{app.name}</option>
                    ))}
                </select>

                {/* Type */}
                <div className="flex gap-1">
                    {(["", "video", "image"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => onFilterChange({ type: t })}
                            className={`${pillBase} ${filters.type === t ? pillActive : pillInactive}`}
                        >
                            {t === "" ? "Alle" : t === "video" ? "Video" : "Bild"}
                        </button>
                    ))}
                </div>

                {/* Gender */}
                <div className="flex gap-1">
                    {(["", "male", "female", "diverse"] as const).map((g) => (
                        <button
                            key={g}
                            onClick={() => onFilterChange({ gender: g })}
                            className={`${pillBase} ${filters.gender === g ? pillActive : pillInactive}`}
                        >
                            {g === "" ? "Alle" : g === "male" ? "Männlich" : g === "female" ? "Weiblich" : "Divers"}
                        </button>
                    ))}
                </div>

                {/* Skin tone */}
                <div className="flex gap-1">
                    {(["", "light", "medium", "dark"] as const).map((s) => (
                        <button
                            key={s}
                            onClick={() => onFilterChange({ skinTone: s })}
                            className={`${pillBase} ${filters.skinTone === s ? pillActive : pillInactive}`}
                        >
                            {s === "" ? "Alle" : s === "light" ? "Hell" : s === "medium" ? "Mittel" : "Dunkel"}
                        </button>
                    ))}
                </div>

                {/* Upload button — pushed to right */}
                <button
                    onClick={onUploadClick}
                    className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-accent text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                >
                    <Upload size={15} />
                    Upload
                </button>
            </div>

            {/* Grid */}
            {items === undefined ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-surface2 animate-pulse" style={{ aspectRatio: "9/16" }} />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-secondary text-lg mb-2">Keine Medien gefunden.</p>
                    <p className="text-secondary/60 text-sm">Passe die Filter an oder lade etwas hoch.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {items.map((item) => (
                        <MediaCard key={item._id} item={item} onClick={() => onCardClick(item)} />
                    ))}
                </div>
            )}
        </div>
    );
}
```

---

## Task 8: Wire Up Media Page

**Files:**
- Modify: `src/app/admin/(dashboard)/media/page.tsx`

- [ ] **Step 1: Replace the dummy page with the full implementation**

```typescript
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { MediaGrid } from "@/components/admin/media/MediaGrid";
import { MediaModal } from "@/components/admin/media/MediaModal";
import { UploadModal } from "@/components/admin/media/UploadModal";
import { MediaItem } from "@/components/admin/media/MediaCard";

interface Filters {
    appId: Id<"apps"> | "";
    type: "video" | "image" | "";
    gender: "male" | "female" | "diverse" | "";
    skinTone: "light" | "medium" | "dark" | "";
    language: string;
}

const DEFAULT_FILTERS: Filters = {
    appId: "",
    type: "",
    gender: "",
    skinTone: "",
    language: "",
};

export default function MediaPage() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const apps = useQuery(api.apps.queries.getAll);
    const items = useQuery(api.media.queries.getAll, {
        appId: filters.appId || undefined,
        type: filters.type || undefined,
        gender: filters.gender || undefined,
        skinTone: filters.skinTone || undefined,
        language: filters.language || undefined,
    });

    const handleFilterChange = useCallback((partial: Partial<Filters>) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    }, []);

    const appName = apps?.find((a) => a._id === selectedItem?.appId)?.name ?? "";

    const handleUploaded = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-1">Media</h1>
                <p className="text-secondary">Wiederverwendbare Medien für Creator.</p>
            </div>

            <MediaGrid
                key={refreshKey}
                items={items as MediaItem[] | undefined}
                apps={apps}
                filters={filters}
                onFilterChange={handleFilterChange}
                onCardClick={setSelectedItem}
                onUploadClick={() => setShowUpload(true)}
            />

            <MediaModal
                item={selectedItem}
                appName={appName}
                onClose={() => setSelectedItem(null)}
                onDeleted={() => setRefreshKey((k) => k + 1)}
            />

            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUploaded={handleUploaded}
                />
            )}
        </div>
    );
}
```

> **Note:** The `refreshKey` pattern forces `useQuery` to re-fetch after upload/delete. Convex is reactive so in practice the query updates automatically — the key is a belt-and-suspenders.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Schema with all fields
- ✅ Upload flow: file + thumbnail to Vercel Blob, metadata to Convex
- ✅ First-frame extraction via Canvas
- ✅ Grid with 9:16 ratio cards
- ✅ Hover expand icon
- ✅ Click → viewer modal with video player / image
- ✅ Labels displayed in modal
- ✅ Download button
- ✅ Delete (own or admin)
- ✅ Filter bar: app, type, gender, skin tone
- ✅ Upload modal with all form fields
- ✅ Permissions: both admin and creator can upload/view

**Type consistency:** `MediaItem` defined in `MediaCard.tsx` and imported in `MediaModal.tsx`, `MediaGrid.tsx`, and `media/page.tsx` — single source of truth.
