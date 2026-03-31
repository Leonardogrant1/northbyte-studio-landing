# Media Library Design

**Date:** 2026-03-30
**Branch:** feat/creator-interface
**Status:** Approved

---

## Overview

Replace the dummy Media page with a full media library. Admins and creators can upload videos and images, label them with metadata, and browse/filter assets. Assets are stored on Cloudflare R2 via Vercel Blob. Video thumbnails are generated client-side from the first frame using the Canvas API.

---

## 1. Database Schema

### `media` table — new

```ts
media: defineTable({
  title: v.string(),
  type: v.union(v.literal("video"), v.literal("image")),
  fileUrl: v.string(),           // Vercel Blob public URL
  thumbnailUrl: v.string(),      // Vercel Blob public URL (JPEG, first frame for video)
  appId: v.id("apps"),           // required — one app per asset
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
  language: v.optional(v.string()),  // ISO 639-1: "de", "en", "es", …
  uploadedBy: v.id("users"),
  createdAt: v.number(),
})
  .index("by_app", ["appId"])
  .index("by_type", ["type"])
  .index("by_uploader", ["uploadedBy"])
```

---

## 2. Upload Flow

1. User opens Upload Modal via "Upload" button
2. Selects file (video: mp4/mov/webm, image: jpg/png/webp)
3. **Video:** hidden `<video>` element loads file → seeked to 0 → `canvas.drawImage()` → exported as JPEG blob
4. **Image:** file used directly as thumbnail
5. Thumbnail previewed in modal immediately
6. User fills in: Title (required), App (required, dropdown), Gender, Skin Tone, Language (all optional)
7. Submit:
   - Upload original file → `POST /api/upload-video` (rename to `/api/upload-media`)
   - Upload thumbnail JPEG → same endpoint
   - Call Convex mutation `createMedia` with both URLs + metadata
8. Modal closes, new asset appears at top of grid

---

## 3. Permissions

| Action | Admin | Creator |
|--------|-------|---------|
| View / browse | ✅ | ✅ |
| Upload | ✅ | ✅ |
| Delete own assets | ✅ | ✅ |
| Delete others' assets | ✅ | ❌ |

---

## 4. UI

### Filter Bar
- App dropdown (required filter — defaults to first app or "Alle")
- Gender pill filter: Alle / Male / Female / Diverse
- Skin Tone pill filter: Alle / Light / Medium / Dark
- Language dropdown
- Type toggle: Alle / Video / Bild

### Grid
- Responsive columns (3–4 col on desktop, 2 on tablet)
- Portrait ratio cards (9:16) — thumbnail as background-cover
- Hover state: semi-transparent overlay + centered expand icon (↗)
- Video cards: small video-camera icon badge (top-left)

### Media Modal (expand)
- Large centered overlay with backdrop blur
- Video: native `<video>` with controls, autoplay, loop
- Image: full `<img>`
- Below media: Title, App badge, Gender/SkinTone/Language labels
- Download button + Close (×)
- Delete button (only for own uploads or admin)

### Upload Modal
- Drag & drop zone or click to browse
- Thumbnail preview generated live
- Form fields: Title, App (select), Gender (select), Skin Tone (select), Language (text input)
- Upload progress indicator
- Error handling for unsupported file types / upload failures

---

## 5. Backend Changes

### New Convex functions

**`convex/media/queries.ts`**
- `getAll({ appId?, gender?, skinTone?, language?, type? })` — filtered list, requires auth

**`convex/media/mutations.ts`**
- `createMedia({ title, type, fileUrl, thumbnailUrl, appId, gender?, skinTone?, language? })` — requires auth
- `deleteMedia(mediaId)` — requires auth; only uploader or admin can delete

### API Route
- Rename/extend `src/app/api/upload-video/route.ts` → `src/app/api/upload-media/route.ts`
- Accept both video and image MIME types

---

## 6. Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| Modify | `convex/schema.ts` | Add `media` table |
| Create | `convex/media/queries.ts` | `getAll` with filters |
| Create | `convex/media/mutations.ts` | `createMedia`, `deleteMedia` |
| Modify | `src/app/api/upload-media/route.ts` | Accept video + image |
| Modify | `src/app/admin/(dashboard)/media/page.tsx` | Full Media Library UI |
| Create | `src/components/admin/media/MediaGrid.tsx` | Grid + filter bar |
| Create | `src/components/admin/media/MediaCard.tsx` | Single grid card with hover |
| Create | `src/components/admin/media/MediaModal.tsx` | Video/image viewer modal |
| Create | `src/components/admin/media/UploadModal.tsx` | Upload form + thumbnail generation |
