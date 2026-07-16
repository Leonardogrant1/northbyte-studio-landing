# User-Attachments im Adminpanel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können auf der Users-Page Dateien (v.a. unterschriebene Affiliate-Verträge als PDF) an einen User anhängen: hochladen, auflisten, downloaden, löschen.

**Architecture:** Neue Convex-Tabelle `user_attachments` + admin-only Queries/Mutations. Dateien liegen im R2-Bucket `northbyte-media` (Public-URL `https://media.northbyte.studio`), Upload über das bestehende Presigned-URL-Pattern. UI ist ein Modal auf der bestehenden Users-Page, geöffnet über ein Büroklammer-Icon mit Count-Badge pro User-Zeile.

**Tech Stack:** Next.js (App Router, Client Components), Convex (Queries/Mutations, `usePaginatedQuery`/`useQuery`/`useMutation`), Cloudflare R2 via AWS SDK S3Client, Tailwind, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-07-16-user-attachments-design.md`

## Global Constraints

- **KEIN `git commit` / `git push` durch Agents.** Leonardo committet selbst. Am Ende jedes Tasks nur die geänderten Dateien benennen.
- Paketmanager ist **pnpm** (Monorepo mit turbo). Convex-Backend liegt in `packages/backend`, Web-App in `apps/web`.
- Es gibt **keine Test-Suite** im Projekt. Verifikation = TypeScript-Check (`npx tsc --noEmit`) + Convex codegen + manueller Durchlauf (letzter Task). Keine neuen Test-Frameworks einführen.
- Bucket-Name exakt: `northbyte-media`. Public-URL exakt: `https://media.northbyte.studio`. Env-Var-Name exakt: `R2_NORTHBYTE_PUBLIC_URL`.
- R2-Key-Schema exakt: `user-attachments/{userId}/{timestamp}-{safeName}`.
- UI-Texte auf Deutsch, Styling-Klassen exakt wie in den Code-Blöcken (entsprechen dem Bestand der Users-Page).
- Alle neuen Convex-Funktionen haben einen serverseitigen Admin-Check (`caller.type !== "admin"` → throw), Muster wie `packages/backend/convex/users/queries.ts:38-52`.

---

### Task 1: Convex-Backend (Schema + Queries + Mutations)

**Files:**
- Modify: `packages/backend/convex/schema.ts` (neue Tabelle, einfügen nach `user_app_assignments`, ca. Zeile 103)
- Create: `packages/backend/convex/user_attachments/queries.ts`
- Create: `packages/backend/convex/user_attachments/mutations.ts`

**Interfaces:**
- Consumes: bestehende `users`-Tabelle (Index `by_clerk`, Feld `type`).
- Produces (von Task 3 verwendet):
  - `api.user_attachments.queries.getByUserId({ userId: Id<"users"> })` → `Doc<"user_attachments">[]` (absteigend nach `uploadedAt`)
  - `api.user_attachments.queries.getCountsByUser({})` → `Record<string, number>` (userId → Anzahl)
  - `api.user_attachments.mutations.create({ userId, fileName, fileKey, fileUrl, fileType, fileSize })` → `Id<"user_attachments">`
  - `api.user_attachments.mutations.remove({ attachmentId: Id<"user_attachments"> })` → `{ fileKey: string }`

- [ ] **Step 1: Tabelle im Schema ergänzen**

In `packages/backend/convex/schema.ts` direkt nach dem `user_app_assignments`-Block einfügen:

```ts
    user_attachments: defineTable({
        userId: v.id("users"),
        fileName: v.string(),      // Original-Dateiname, z.B. "affiliate-vertrag-signiert.pdf"
        fileKey: v.string(),       // R2-Objekt-Key: user-attachments/{userId}/{timestamp}-{safeName}
        fileUrl: v.string(),       // Public-Download-URL (media.northbyte.studio)
        fileType: v.string(),      // MIME-Type
        fileSize: v.number(),      // Bytes
        uploadedAt: v.number(),
    }).index("by_user", ["userId"]),
```

- [ ] **Step 2: Queries anlegen**

Create `packages/backend/convex/user_attachments/queries.ts`:

```ts
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
}

// Admin-only — alle Attachments eines Users, neueste zuerst.
export const getByUserId = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const attachments = await ctx.db
            .query("user_attachments")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        return attachments.sort((a, b) => b.uploadedAt - a.uploadedAt);
    },
});

// Admin-only — Anzahl Attachments je User, für die Badges in der User-Tabelle.
export const getCountsByUser = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);

        const all = await ctx.db.query("user_attachments").collect();
        const counts: Record<string, number> = {};
        for (const attachment of all) {
            counts[attachment.userId] = (counts[attachment.userId] ?? 0) + 1;
        }
        return counts;
    },
});
```

- [ ] **Step 3: Mutations anlegen**

Create `packages/backend/convex/user_attachments/mutations.ts`:

```ts
import { mutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: MutationCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
        .query("users")
        .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
        .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
}

// Admin-only — wird NACH erfolgreichem R2-Upload aufgerufen (kein verwaister DB-Eintrag).
export const create = mutation({
    args: {
        userId: v.id("users"),
        fileName: v.string(),
        fileKey: v.string(),
        fileUrl: v.string(),
        fileType: v.string(),
        fileSize: v.number(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) throw new Error("User not found");

        return await ctx.db.insert("user_attachments", {
            ...args,
            uploadedAt: Date.now(),
        });
    },
});

// Admin-only — löscht nur den DB-Eintrag; das R2-Objekt entfernt der Client
// über /api/r2/delete (verwaiste R2-Objekte sind akzeptabel, umgekehrt nicht).
export const remove = mutation({
    args: { attachmentId: v.id("user_attachments") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const attachment = await ctx.db.get(args.attachmentId);
        if (!attachment) throw new Error("Attachment not found");

        await ctx.db.delete(args.attachmentId);
        return { fileKey: attachment.fileKey };
    },
});
```

- [ ] **Step 4: Codegen laufen lassen**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/packages/backend && pnpm codegen`
Expected: läuft ohne Fehler durch; `convex/_generated/api.d.ts` enthält danach `user_attachments`.

- [ ] **Step 5: TypeScript-Check**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/packages/backend && npx tsc --noEmit`
Expected: Exit-Code 0, keine Fehler.

- [ ] **Step 6: Geänderte Dateien an Leonardo melden (kein Commit)**

Dateien: `packages/backend/convex/schema.ts`, `packages/backend/convex/user_attachments/queries.ts`, `packages/backend/convex/user_attachments/mutations.ts`.

---

### Task 2: R2-Konfiguration (Bucket-Konstante, Public-URL, Env)

**Files:**
- Modify: `apps/web/src/lib/r2-constants.ts`
- Modify: `apps/web/src/lib/r2.ts:15-18` (`R2_PUBLIC_URLS`)
- Modify: `apps/web/.env.local` (Zeile anhängen)
- Modify: `apps/web/.env.local.example` (Zeile anhängen)

**Interfaces:**
- Consumes: bestehender `S3Client` (`r2Client`) — ein Credentials-Paar für alle Buckets, keine neuen Keys nötig.
- Produces (von Task 3 verwendet): `R2_BUCKETS.northbyte === "northbyte-media"`; `getPublicUrl(R2_BUCKETS.northbyte, key)` liefert `https://media.northbyte.studio/{key}`.

- [ ] **Step 1: Enum-Eintrag ergänzen**

`apps/web/src/lib/r2-constants.ts` — kompletter neuer Inhalt:

```ts
export enum R2_BUCKETS {
    n8n = "n8n-media",
    support = "support-media",
    northbyte = "northbyte-media",
}
```

- [ ] **Step 2: Public-URL-Mapping ergänzen**

In `apps/web/src/lib/r2.ts` das Objekt `R2_PUBLIC_URLS` erweitern:

```ts
export const R2_PUBLIC_URLS = {
    [R2_BUCKETS.n8n]: process.env.R2_N8N_PUBLIC_URL!,
    [R2_BUCKETS.support]: process.env.R2_SUPPORT_PUBLIC_URL!,
    [R2_BUCKETS.northbyte]: process.env.R2_NORTHBYTE_PUBLIC_URL!,
};
```

- [ ] **Step 3: Env-Vars ergänzen**

An `apps/web/.env.local` UND `apps/web/.env.local.example` jeweils anhängen:

```
R2_NORTHBYTE_PUBLIC_URL=https://media.northbyte.studio
```

Hinweis an Leonardo im Task-Report: dieselbe Variable auch im Produktions-Environment (z.B. Vercel) setzen.

- [ ] **Step 4: TypeScript-Check**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/apps/web && npx tsc --noEmit`
Expected: Exit-Code 0 (bzw. keine NEUEN Fehler gegenüber dem Stand vor der Änderung — falls Bestandsfehler existieren, vorher einmal ohne Änderungen laufen lassen und vergleichen).

- [ ] **Step 5: Geänderte Dateien an Leonardo melden (kein Commit)**

Dateien: `apps/web/src/lib/r2-constants.ts`, `apps/web/src/lib/r2.ts`, `apps/web/.env.local`, `apps/web/.env.local.example`.

---

### Task 3: API-Routen erweitern (PDF-Upload erlauben, Delete für northbyte-media)

**Files:**
- Modify: `apps/web/src/app/api/r2/upload-url/route.ts:9-17` (`ALLOWED_TYPES`)
- Modify: `apps/web/src/app/api/r2/delete/route.ts` (komplett ersetzen)

**Interfaces:**
- Consumes: `R2_BUCKETS.northbyte` aus Task 2; `deleteR2Object(bucket, key)` aus `apps/web/src/lib/r2.ts`; `getAuthenticatedUserId()` aus `apps/web/src/lib/auth.ts`.
- Produces (vom Modal in Task 4 verwendet):
  - `POST /api/r2/upload-url` mit Body `{ bucket: "northbyte-media", fileName, fileType, key }` → `{ uploadUrl, key, downloadUrl }` — akzeptiert jetzt auch PDF/DOC/DOCX/TXT.
  - `DELETE /api/r2/delete` mit Body `{ bucket: "northbyte-media", key }` → `{ success: true }`; ohne `bucket` weiterhin altes Verhalten (n8n + `videos/`-Prefix), damit der bestehende Caller `apps/web/src/components/admin/EditContentModal.tsx` unverändert funktioniert.

- [ ] **Step 1: Dokumenttypen in upload-url erlauben**

In `apps/web/src/app/api/r2/upload-url/route.ts` das Array `ALLOWED_TYPES` ersetzen durch:

```ts
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
```

- [ ] **Step 2: Delete-Route ersetzen**

`apps/web/src/app/api/r2/delete/route.ts` — kompletter neuer Inhalt:

```ts
import { NextRequest, NextResponse } from "next/server";
import { deleteR2Object } from "@/lib/r2";
import { getAuthenticatedUserId } from "@/lib/auth";
import { R2_BUCKETS } from "@/lib/r2-constants";

// Whitelist: welche Key-Prefixe in welchem Bucket gelöscht werden dürfen
const DELETABLE: { bucket: R2_BUCKETS; pattern: RegExp }[] = [
    { bucket: R2_BUCKETS.n8n, pattern: /^videos\/[^/]+$/ },
    { bucket: R2_BUCKETS.northbyte, pattern: /^user-attachments\/[^/]+\/[^/]+$/ },
];

export async function DELETE(request: NextRequest) {
    const clerkUserId = await getAuthenticatedUserId();
    if (!clerkUserId) {
        const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!apiKey || apiKey !== process.env.NORTHBYTE_API_KEY) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    try {
        const { key, bucket } = (await request.json()) as { key?: string; bucket?: string };

        if (!key || typeof key !== "string") {
            return NextResponse.json({ error: "key is required" }, { status: 400 });
        }

        // Ohne bucket-Angabe: bisheriges Verhalten (n8n) für bestehende Caller
        const targetBucket = bucket ?? R2_BUCKETS.n8n;
        const rule = DELETABLE.find((r) => r.bucket === targetBucket && r.pattern.test(key));
        if (!rule) {
            return NextResponse.json({ error: "Invalid key" }, { status: 400 });
        }

        await deleteR2Object(rule.bucket, key);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error deleting R2 object:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}
```

Hinweis: Die Route hatte bisher **gar keinen** Auth-Check — der neue Check (Clerk-Session ODER `NORTHBYTE_API_KEY`-Bearer, identisch zur upload-url-Route) ist eine gezielte Härtung. Einziger Caller im Repo ist `EditContentModal.tsx` (läuft im Browser mit Clerk-Session, funktioniert also weiter).

- [ ] **Step 3: TypeScript-Check**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/apps/web && npx tsc --noEmit`
Expected: Exit-Code 0 / keine neuen Fehler.

- [ ] **Step 4: Geänderte Dateien an Leonardo melden (kein Commit)**

Dateien: `apps/web/src/app/api/r2/upload-url/route.ts`, `apps/web/src/app/api/r2/delete/route.ts`.

---

### Task 4: UI — UserAttachmentsModal + Integration in die Users-Page

**Files:**
- Create: `apps/web/src/components/admin/UserAttachmentsModal.tsx`
- Modify: `apps/web/src/app/admin/(dashboard)/users/page.tsx` (Import ca. Zeile 5-9, State ca. Zeile 336-337, Aktions-Zelle ca. Zeile 633-643, Modal-Render ca. Zeile 699-710)

**Interfaces:**
- Consumes: `api.user_attachments.queries.getByUserId`, `api.user_attachments.queries.getCountsByUser`, `api.user_attachments.mutations.create`, `api.user_attachments.mutations.remove` (Task 1); `POST /api/r2/upload-url` und `DELETE /api/r2/delete` (Task 3).
- Produces: `UserAttachmentsModal({ userId: Id<"users">, userEmail: string, onClose: () => void })` — named export.

- [ ] **Step 1: Modal-Komponente anlegen**

Create `apps/web/src/components/admin/UserAttachmentsModal.tsx`:

```tsx
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
        if (!window.confirm(`„${fileName}“ wirklich löschen?`)) return;
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
```

- [ ] **Step 2: Users-Page integrieren**

In `apps/web/src/app/admin/(dashboard)/users/page.tsx` vier Änderungen:

**(a)** Imports erweitern (Zeile 5 und nach Zeile 9):

```tsx
import { Trash2, UserPlus, Loader2, Pencil, X, Paperclip } from "lucide-react";
// …
import { UserAttachmentsModal } from "@/components/admin/UserAttachmentsModal";
```

**(b)** In `UsersPage` neben den bestehenden Modal-States (nach Zeile 337) ergänzen — plus die Count-Query bei den anderen Queries (nach Zeile 326):

```tsx
const attachmentCounts = useQuery(api.user_attachments.queries.getCountsByUser, isAdmin ? {} : "skip");
// …
const [attachmentsFor, setAttachmentsFor] = useState<{ id: Id<"users">; email: string } | null>(null);
```

**(c)** In der Aktions-Zelle der „Aktive Benutzer"-Tabelle (Zeile 633-643) den Büroklammer-Button VOR dem bestehenden Pencil-Button einfügen, sodass die Zelle so aussieht:

```tsx
<td className="px-4 py-3 text-right">
    <button
        onClick={() => setAttachmentsFor({ id: u._id, email: u.email ?? "—" })}
        className="relative text-secondary hover:text-accent transition-colors p-1"
        title="Anhänge"
    >
        <Paperclip size={16} />
        {(attachmentCounts?.[u._id] ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-background text-[10px] font-bold flex items-center justify-center">
                {attachmentCounts?.[u._id]}
            </span>
        )}
    </button>
    {u.type === "affiliate" && (
        <button
            onClick={() => setEditingUserId(u._id)}
            className="text-secondary hover:text-accent transition-colors p-1"
            title="Affiliate bearbeiten"
        >
            <Pencil size={16} />
        </button>
    )}
</td>
```

**(d)** Modal-Render am Seitenende neben den bestehenden Modals (nach Zeile 710) ergänzen:

```tsx
{attachmentsFor && (
    <UserAttachmentsModal
        userId={attachmentsFor.id}
        userEmail={attachmentsFor.email}
        onClose={() => setAttachmentsFor(null)}
    />
)}
```

- [ ] **Step 3: TypeScript-Check**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/apps/web && npx tsc --noEmit`
Expected: Exit-Code 0 / keine neuen Fehler. (Falls `api.user_attachments` fehlt: Task 1 Step 4 codegen erneut ausführen.)

- [ ] **Step 4: Geänderte Dateien an Leonardo melden (kein Commit)**

Dateien: `apps/web/src/components/admin/UserAttachmentsModal.tsx`, `apps/web/src/app/admin/(dashboard)/users/page.tsx`.

---

### Task 5: Manuelle Verifikation (End-to-End)

**Files:** keine Änderungen — nur Durchlauf.

**Voraussetzungen:** Convex-Dev-Deployment läuft (`cd packages/backend && pnpm dev` pusht das neue Schema), Web-App läuft (`cd apps/web && pnpm dev`), Login als Admin.

- [ ] **Step 1: Schema-Push prüfen**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio/packages/backend && pnpm dev` (kurz laufen lassen)
Expected: Schema-Sync ohne Fehler, Tabelle `user_attachments` erscheint im Convex-Dashboard.

- [ ] **Step 2: Upload-Durchlauf**

Auf `/admin/users`: Büroklammer bei einem User klicken → PDF hochladen (Drag & Drop UND Dateiauswahl testen).
Expected: Fortschrittsbalken, Erfolgs-Toast, Datei erscheint in der Liste, Badge an der Büroklammer zeigt die Anzahl. Bei `403` am PUT: R2-API-Token in Cloudflare um den Bucket `northbyte-media` erweitern (Token bearbeiten, keine neuen Keys nötig).

- [ ] **Step 3: Download prüfen**

Download-Icon klicken.
Expected: Datei öffnet unter `https://media.northbyte.studio/user-attachments/…`.

- [ ] **Step 4: Löschen prüfen**

Löschen-Icon → Bestätigen.
Expected: Eintrag verschwindet, Badge-Count sinkt, Objekt ist im R2-Dashboard weg.

- [ ] **Step 5: Zugriffsschutz prüfen**

Als Nicht-Admin (z.B. Creator- oder Affiliate-Account) einloggen.
Expected: Users-Page ist per RoleGuard nicht erreichbar; direkte Convex-Aufrufe der neuen Funktionen werfen "Unauthorized".

- [ ] **Step 6: Bestandsfunktion prüfen (Regression)**

Im Admin unter Content (EditContentModal) einen bestehenden Lösch-Flow einmal auslösen (oder zumindest sicherstellen, dass die Seite lädt).
Expected: Bisheriges Verhalten unverändert (Delete-Route ist rückwärtskompatibel: ohne `bucket`-Feld → n8n + `videos/`-Prefix).
