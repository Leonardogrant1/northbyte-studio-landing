# Postiz Path + R2 Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a successful Postiz upload, store the Postiz CDN path in Convex (instead of the R2 URL) and delete the now-redundant R2 file. R2 becomes a temporary staging area only.

**Architecture:** Two changes. First, fix the R2 delete route's key validation regex (currently `^videos\/[^/]+$` which rejects all real keys). Second, update `handleSchedule` in `post-content/page.tsx` to: (a) capture the `key` returned from the upload-url API, (b) delete each R2 file after its Postiz upload succeeds, (c) pass Postiz `path` URLs to `createPost` instead of R2 URLs.

**Tech Stack:** Next.js API routes, existing `/api/r2/delete` and `/api/r2/upload-url` routes, `uploadToR2` helper in `post-content/page.tsx`

## Global Constraints

- Do not change the upload mechanism (presigned URL to R2) — only the cleanup and what gets stored in Convex
- R2 deletion is best-effort: a failed delete must NOT abort the post scheduling — log the error and continue
- Postiz `path` (e.g. `https://uploads.postiz.com/image.png`) replaces R2 URL as `mediaUrls` in `createPost`
- No new dependencies
- No testing framework — verification is manual via dev server
- Do not commit — user handles git

---

### Task 1: Fix R2 delete route key validation

**Files:**
- Modify: `src/app/api/r2/delete/route.ts`

**Problem:** The current regex `^videos\/[^/]+$` only accepts keys prefixed with `videos/`, but actual upload keys are formatted as `{uuid}_{safeName}` (e.g. `550e8400-e29b-41d4-a716-446655440000_video.mp4`) with no prefix. Every real delete call would be rejected with 400.

**Fix:** Replace the overly-restrictive regex with one that matches the actual key format: alphanumeric characters, hyphens, underscores, dots — no path traversal (`..`) allowed.

- [ ] **Step 1: Update key validation in delete route**

  In `src/app/api/r2/delete/route.ts`, replace:
  ```ts
  // Only allow deletion of keys under the videos/ prefix
  if (!/^videos\/[^/]+$/.test(key)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  ```
  with:
  ```ts
  if (!/^[a-zA-Z0-9_\-./]+$/.test(key) || key.includes("..")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  ```
  This allows UUID-prefixed keys while still blocking path traversal.

- [ ] **Step 2: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

---

### Task 2: Capture key from upload-url and store Postiz path in Convex

**Files:**
- Modify: `src/app/admin/(dashboard)/post-content/page.tsx`

**What changes:**
1. `uploadToR2` returns `{ url, key }` instead of just a URL string
2. `handleSchedule` collects `r2Keys` alongside `r2Urls`
3. After all Postiz uploads succeed, delete each R2 file (best-effort, errors logged not thrown)
4. Pass `postizMedia.map(m => m.path)` to `createPost` instead of `r2Urls`

- [ ] **Step 1: Update `uploadToR2` to return key**

  In `post-content/page.tsx`, change the `uploadToR2` function signature and return:

  Current:
  ```ts
  async function uploadToR2(
      file: File,
      onProgress?: (pct: number) => void
  ): Promise<string> {
      const res = await fetch("/api/r2/upload-url", { ... });
      if (!res.ok) throw new Error("Presigned URL konnte nicht abgerufen werden.");
      const { uploadUrl, downloadUrl } = await res.json();
      // ... XHR upload ...
      return downloadUrl;
  }
  ```

  New:
  ```ts
  async function uploadToR2(
      file: File,
      onProgress?: (pct: number) => void
  ): Promise<{ url: string; key: string }> {
      const res = await fetch("/api/r2/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              bucket: R2_BUCKETS.n8n,
              fileName: file.name,
              fileType: file.type,
          }),
      });
      if (!res.ok) throw new Error("Presigned URL konnte nicht abgerufen werden.");
      const { uploadUrl, downloadUrl, key } = await res.json();

      await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
          });
          xhr.addEventListener("load", () =>
              xhr.status >= 200 && xhr.status < 300
                  ? resolve()
                  : reject(new Error(`Upload fehlgeschlagen (${xhr.status})`))
          );
          xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler beim Upload")));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
      });

      return { url: downloadUrl, key };
  }
  ```

- [ ] **Step 2: Update `handleSchedule` to collect keys, delete R2, use Postiz paths**

  In `handleSchedule`, find the R2 upload loop and the `createPost` call. Make these changes:

  **R2 upload loop** — collect `key` alongside `url`:
  ```ts
  const r2Results: { url: string; key: string }[] = [];
  for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      setUploadStatus(`R2: Datei ${i + 1}/${mediaFiles.length} hochladen…`);
      const normalized = file.type.startsWith("video/")
          ? await normalizeVideoFile(file)
          : file;
      const result = await uploadToR2(normalized, (pct) => {
          setUploadStatus(`R2: Datei ${i + 1}/${mediaFiles.length}: ${pct}%`);
      });
      r2Results.push(result);
  }
  const r2Urls = r2Results.map((r) => r.url);
  ```

  **Postiz upload loop** — unchanged, still uses `r2Urls[i]`:
  ```ts
  const postizMedia: { id: string; path: string }[] = [];
  for (let i = 0; i < r2Urls.length; i++) {
      setUploadStatus(`Postiz: Medium ${i + 1}/${r2Urls.length} hochladen…`);
      const uploadRes = await fetch("/api/postiz/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: r2Urls[i] }),
      });
      if (!uploadRes.ok) throw new Error(`Postiz-Upload fehlgeschlagen für Medium ${i + 1}.`);
      const { id, path } = await uploadRes.json();
      postizMedia.push({ id, path });
  }
  ```

  **R2 cleanup** — add this block right after the Postiz upload loop, before the account loop:
  ```ts
  // Best-effort R2 cleanup — R2 was only a staging area
  for (const { key } of r2Results) {
      try {
          await fetch("/api/r2/delete", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key }),
          });
      } catch (err) {
          console.error("R2 cleanup fehlgeschlagen für key:", key, err);
      }
  }
  ```

  **`createPost` call** — change `mediaUrls: r2Urls` to `mediaUrls: postizMedia.map((m) => m.path)`:
  ```ts
  await createPost({
      title: title.trim(),
      description: description.trim() || undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
      mediaUrls: postizMedia.map((m) => m.path),
      accountId: account._id,
      postizPostId,
  });
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `npx tsc --noEmit`
  Expected: no errors

- [ ] **Step 4: Manual verification checklist**

  Run: `npm run dev` and test at `/admin/post-content`:
  - [ ] Upload an image → schedule post → R2 delete request appears in browser network tab (200 OK)
  - [ ] Convex document for the post has `mediaUrls` containing `uploads.postiz.com` URLs (not R2 URLs)
  - [ ] A failed R2 delete (e.g. simulate with network block) does not abort the post creation
