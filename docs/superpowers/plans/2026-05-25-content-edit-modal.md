# Content Edit Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an edit modal to `/admin/contents` that lets admins edit any post with status `ready_to_post`, including replacing the video in-place on R2.

**Architecture:** A pencil icon appears per row in `RecentContents` only for `ready_to_post` posts. Clicking opens `EditContentModal`, which pre-fills all fields. On save, if a new video is selected, it is uploaded to R2 using the existing key (overwriting the same object) so the `videoUrl` in Convex never changes. A new Convex `update` mutation patches only the fields that changed.

**Tech Stack:** Next.js App Router, Convex (queries/mutations), Cloudflare R2 (S3-compatible), Tailwind CSS, lucide-react, sonner (toast)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `convex/posts/mutations.ts` | Add `update` mutation |
| Modify | `src/app/api/r2/presigned-url/route.ts` | Accept optional `existingKey` to overwrite same R2 object |
| Create | `src/components/admin/EditContentModal.tsx` | Full edit form as overlay modal |
| Modify | `src/components/admin/RecentContents.tsx` | Add pencil button + render modal |

---

## Task 1: Convex `update` mutation

**Files:**
- Modify: `convex/posts/mutations.ts`

- [ ] **Step 1: Add the `update` mutation**

Append to `convex/posts/mutations.ts`:

```ts
export const update = mutation({
    args: {
        id: v.id("posts"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        hashtags: v.optional(v.array(v.string())),
        videoUrl: v.optional(v.string()),
        accountId: v.optional(v.id("social_accounts")),
        scheduledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        const post = await ctx.db.get(args.id);
        if (!post) throw new Error("Post not found.");

        if (user.type !== "admin" && post.createdBy !== user._id) {
            throw new Error("Unauthorized.");
        }

        if (post.status !== "ready_to_post") {
            throw new Error("Only ready_to_post posts can be edited.");
        }

        const { id, ...fields } = args;
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) patch[key] = value;
        }

        await ctx.db.patch(id, patch);
    },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `convex/posts/mutations.ts`.

- [ ] **Step 3: Commit**

```bash
git add convex/posts/mutations.ts
git commit -m "feat: add update mutation for ready_to_post posts"
```

---

## Task 2: R2 presigned-url route — `existingKey` support

**Files:**
- Modify: `src/app/api/r2/presigned-url/route.ts`

- [ ] **Step 1: Update the route to accept `existingKey`**

Replace the full file content of `src/app/api/r2/presigned-url/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fileName, fileType, existingKey } = body;

        if (!fileName || typeof fileName !== "string") {
            return NextResponse.json(
                { error: "fileName is required and must be a string" },
                { status: 400 }
            );
        }

        if (!fileType || typeof fileType !== "string") {
            return NextResponse.json(
                { error: "fileType is required and must be a string" },
                { status: 400 }
            );
        }

        if (!fileType.startsWith("video/")) {
            return NextResponse.json(
                { error: "Only video files are allowed" },
                { status: 400 }
            );
        }

        let key: string;
        if (existingKey && typeof existingKey === "string" && /^videos\/[^/]+$/.test(existingKey)) {
            key = existingKey;
        } else {
            const fileExtension = fileName.split(".").pop() || "mp4";
            key = `videos/${randomUUID()}.${fileExtension}`;
        }

        const uploadUrl = await generatePresignedUploadUrl(key, 600);
        const downloadUrl = getPublicUrl(key);

        return NextResponse.json({ uploadUrl, key, downloadUrl }, { status: 200 });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/r2/presigned-url/route.ts
git commit -m "feat: support existingKey in presigned-url route to overwrite R2 objects"
```

---

## Task 3: `EditContentModal` component

**Files:**
- Create: `src/components/admin/EditContentModal.tsx`

This component replicates the form from `post-content/page.tsx` but as an overlay modal, pre-filled with existing post data. Video replacement is optional — if no new file is selected, video is untouched.

- [ ] **Step 1: Create the file**

Create `src/components/admin/EditContentModal.tsx` with:

```tsx
"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AssetDropper, AssetDropperRef } from "@/components/admin/AssetDropper";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

const inputClass =
    "w-full rounded-xl bg-surface border border-border px-4 py-3 text-primary text-sm outline-none focus:border-accent transition-colors";

// Minimal shape of a post as returned by getRecent
export type EditablePost = {
    _id: Id<"posts">;
    title: string;
    description?: string;
    hashtags?: string[];
    videoUrl: string;
    accountId: Id<"social_accounts">;
    scheduledAt?: number;
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
            const videoFile = assetDropperRef.current?.getSelectedFile();

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

                    {/* Video replacement (optional) */}
                    <section className="space-y-3">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">Video</h3>
                            <p className="text-xs text-secondary/60 mt-0.5">
                                Optional — leer lassen um das bestehende Video zu behalten.
                            </p>
                        </div>
                        <div className="bg-surface2 p-6 rounded-2xl border border-border flex justify-center">
                            <AssetDropper ref={assetDropperRef} aspectRatio="16:9" />
                        </div>
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/EditContentModal.tsx
git commit -m "feat: add EditContentModal component for ready_to_post posts"
```

---

## Task 4: Wire edit button into `RecentContents`

**Files:**
- Modify: `src/components/admin/RecentContents.tsx`

- [ ] **Step 1: Update imports and add state**

At the top of `src/components/admin/RecentContents.tsx`, update the imports:

```tsx
import { ArrowRight, CheckCircle2, Clock, Send, XCircle, FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { EditContentModal, type EditablePost } from "@/components/admin/EditContentModal";
```

Inside the `RecentContents` function body, add state right after the `posts` query:

```tsx
const [editingPost, setEditingPost] = useState<EditablePost | null>(null);
```

- [ ] **Step 2: Add 5th column to header**

Replace the table header `div`:

```tsx
<div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border">
    <span className="text-xs font-semibold uppercase tracking-wide text-secondary">Titel</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Account</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Status</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right">Erstellt</span>
    <span className="text-xs font-semibold uppercase tracking-wide text-secondary text-right"></span>
</div>
```

- [ ] **Step 3: Update each row grid and add edit button**

Replace the row `div` (the one that maps over posts) — change the `className` grid and add a 5th cell:

```tsx
<div
    key={post._id}
    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-4 transition-colors hover:bg-surface2/80 ${
        idx !== posts.length - 1 ? "border-b border-border/50" : ""
    }`}
>
    {/* Title */}
    <div className="min-w-0">
        <p className="font-medium text-sm text-primary truncate">{post.title}</p>
        {post.description && (
            <p className="text-xs text-secondary truncate mt-0.5">{post.description}</p>
        )}
    </div>

    {/* Account */}
    <div className="text-right">
        {post.account ? (
            <span className="text-xs text-secondary whitespace-nowrap">
                {platformEmoji}{" "}
                <span className="text-primary font-medium">
                    @{post.account.username}
                </span>
            </span>
        ) : (
            <span className="text-xs text-secondary/50">—</span>
        )}
    </div>

    {/* Status badge */}
    <div className="flex justify-end">
        <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.className}`}
        >
            <StatusIcon size={11} />
            {cfg.label}
        </span>
    </div>

    {/* Time */}
    <div className="text-right">
        <span className="text-xs text-secondary whitespace-nowrap">
            {timeAgo(post.createdAt)}
        </span>
    </div>

    {/* Edit action */}
    <div className="flex justify-end">
        {post.status === "ready_to_post" ? (
            <button
                onClick={() =>
                    setEditingPost({
                        _id: post._id,
                        title: post.title,
                        description: post.description,
                        hashtags: post.hashtags,
                        videoUrl: post.videoUrl,
                        accountId: post.accountId,
                        scheduledAt: post.scheduledAt,
                    })
                }
                className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface2 transition-colors"
                title="Bearbeiten"
            >
                <Pencil size={14} />
            </button>
        ) : (
            <div className="w-7" />
        )}
    </div>
</div>
```

- [ ] **Step 4: Render the modal**

At the end of the `section` element (after the table card `div`), add:

```tsx
{editingPost && (
    <EditContentModal
        post={editingPost}
        onClose={() => setEditingPost(null)}
    />
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/RecentContents.tsx
git commit -m "feat: add edit button to contents table for ready_to_post posts"
```

---

## Task 5: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to `/admin/contents`**

Confirm:
- Rows with `ready_to_post` status show a pencil icon on the right
- Rows with other statuses show no icon (just empty space)

- [ ] **Step 3: Open the edit modal**

Click a pencil icon. Confirm:
- Modal opens with all fields pre-filled (title, description, hashtags, account pre-selected)
- Backdrop click closes the modal
- "Abbrechen" button closes the modal

- [ ] **Step 4: Edit metadata only (no video)**

Change the title, save. Confirm:
- Toast "Content erfolgreich aktualisiert." appears
- Modal closes
- Row in the table reflects the updated title immediately (Convex reactive update)

- [ ] **Step 5: Edit with video replacement**

Open a `ready_to_post` post, drop a new video into the AssetDropper, save. Confirm:
- Upload progress is visible in the Save button during upload
- Toast success after save
- Video at the same URL plays the new content (same URL in Convex, R2 object overwritten)
