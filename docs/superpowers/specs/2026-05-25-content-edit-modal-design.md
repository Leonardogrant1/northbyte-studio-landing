# Content Edit Modal — Design Spec

**Date:** 2026-05-25  
**Feature:** Editing posts with status `ready_to_post` from `/admin/contents`

---

## Overview

Admins can edit any post that is in the `ready_to_post` state directly from the contents table. A pencil icon appears in each editable row; clicking it opens a modal pre-filled with the post's current data. All fields are editable including video (which overwrites the same R2 object at the same path).

---

## Scope

- **Editable:** Posts with `status === "ready_to_post"` only
- **Not editable:** `scheduled`, `posted`, `failed`
- **Who can edit:** Admin (all posts); creator (only their own posts) — enforced in Convex mutation

---

## Architecture

### 1. API — `src/app/api/r2/presigned-url/route.ts`

Add optional `existingKey?: string` to the POST body.

- If `existingKey` is provided and matches the pattern `videos/<uuid>.<ext>`, use it as the R2 key instead of generating a new UUID.
- This causes R2 to overwrite the existing object at the same path, keeping the `downloadUrl` (and thus `videoUrl` in Convex) identical — no Convex update needed for the URL field.
- Validate that `existingKey` starts with `videos/` to prevent arbitrary key injection.

### 2. Convex — `convex/posts/mutations.ts`

New `update` mutation:

```ts
args: {
  id: v.id("posts"),
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  hashtags: v.optional(v.array(v.string())),
  videoUrl: v.optional(v.string()),
  accountId: v.optional(v.id("social_accounts")),
  scheduledAt: v.optional(v.number()),
}
```

Handler logic:
1. Authenticate user
2. Fetch the post; throw if not found
3. If user is not admin, verify `post.createdBy === user._id`
4. Verify `post.status === "ready_to_post"`; throw otherwise
5. Patch with only the provided fields (undefined fields are ignored)

### 3. New Component — `src/components/admin/EditContentModal.tsx`

A full-screen overlay modal with:

- **Header:** "Content bearbeiten" + X close button
- **Account selector:** Same pill-button pattern as `post-content/page.tsx`, pre-selected to current account
- **Video section:** Shows current video filename/URL as preview text; `AssetDropper` below for optional replacement. If no new file selected, video is unchanged.
- **Titel field** (required): pre-filled
- **Beschreibung field** (optional): pre-filled
- **Hashtags field**: tag-input with X-remove, pre-filled from `post.hashtags`
- **Upload + Save button:**
  1. If new video selected: `POST /api/r2/presigned-url` with `{ fileName, fileType, existingKey }` where `existingKey` is extracted from current `videoUrl` (parse path segment after last `/` in the R2 URL, prepend `videos/`)
  2. PUT video to R2 presigned URL (with progress tracking)
  3. Call `useMutation(api.posts.mutations.update)` with changed fields
  4. On success: `toast.success`, close modal
  5. On error: `toast.error`, stay open

State:
- `title`, `description`, `hashtags`, `hashtagInput` — local string state
- `selectedAccountId` — pre-set from post
- `uploadProgress` — number 0–100
- `isSaving` — boolean

Props:
```ts
{
  post: {
    _id: Id<"posts">,
    title: string,
    description?: string,
    hashtags?: string[],
    videoUrl: string,
    accountId: Id<"social_accounts">,
    scheduledAt?: number,
    status: string,
  },
  onClose: () => void,
}
```

### 4. Updated Component — `src/components/admin/RecentContents.tsx`

- Grid changes from `grid-cols-[1fr_auto_auto_auto]` to `grid-cols-[1fr_auto_auto_auto_auto]`
- Table header gets a 5th column header (empty label, right-aligned)
- Each row: render a `<button>` with `Pencil` icon (size 14) in the 5th column — only when `post.status === "ready_to_post"`, otherwise render an empty `<div>`
- State: `editingPost: PostType | null` — set on pencil click, cleared on modal close
- Render `{editingPost && <EditContentModal post={editingPost} onClose={() => setEditingPost(null)} />}` at the bottom of the section

---

## Data Flow

```
User clicks Pencil icon
  → setEditingPost(post)
  → <EditContentModal> opens with pre-filled state

User edits fields, optionally selects new video, clicks Save
  → if new video:
      POST /api/r2/presigned-url { fileName, fileType, existingKey }
      PUT video → R2 (same key, overwrites)
      videoUrl unchanged
  → useMutation(api.posts.mutations.update) { id, ...changedFields }
  → Convex patches post document
  → useQuery(getRecent) re-runs reactively
  → List updates automatically
  → Modal closes
```

---

## Edge Cases

- **No video replacement:** `AssetDropper` has no file selected → skip R2 upload, don't include `videoUrl` in mutation args
- **Concurrent edit:** Convex optimistic updates handle UI; server enforces status check
- **Non-ready post:** Edit button not rendered — mutation also validates status server-side as defense in depth

---

## Out of Scope

- Editing `scheduled`, `posted`, or `failed` posts
- Deleting posts
- Soft-delete of old R2 objects (orphaned only if key changes, which it won't in this flow)
