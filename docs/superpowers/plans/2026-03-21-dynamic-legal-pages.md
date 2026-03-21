# Dynamic Legal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `termsOfUse` and `privacyPolicy` markdown fields to the `apps` table, expose them in the admin panel for editing, and render them on the public legal pages using `react-markdown`.

**Architecture:** Two optional string fields are added directly to the Convex `apps` document. The admin panel's existing app settings form is extended with two textareas for these fields. The public `/terms-of-use/[app]` and `/privacy-policy/[app]` pages check the DB field first; if present, they render via `react-markdown`; otherwise they fall back to the existing hardcoded content.

**Tech Stack:** Convex (schema + mutations), Next.js 15 (App Router, client components), react-markdown, rehype-sanitize, Tailwind CSS + Tailwind Typography (prose classes already in use)

**Note:** Do NOT run git commands — the user manages all commits themselves.

---

### Task 1: Export hardcoded legal content as reference txt files

**Files:**
- Create: `docs/legal-export/keevio-privacy.txt`
- Create: `docs/legal-export/keevio-terms.txt`
- Create: `docs/legal-export/memolib-privacy.txt`
- Create: `docs/legal-export/memolib-terms.txt`
- Create: `docs/legal-export/general-privacy.txt`
- Create: `docs/legal-export/general-terms.txt`

These files are HTML source (stripped of the TypeScript export wrapper) for the admin to reference when converting to markdown.

- [ ] **Step 1: Create `docs/legal-export/keevio-privacy.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/keevio.ts` (everything between the backticks, excluding the `export const keevioPrivacyPolicy = \`` wrapper) into this file.

- [ ] **Step 2: Create `docs/legal-export/keevio-terms.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/keevio-terms.ts`.

- [ ] **Step 3: Create `docs/legal-export/memolib-privacy.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/memolib.ts`.

- [ ] **Step 4: Create `docs/legal-export/memolib-terms.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/memolib-terms.ts`.

- [ ] **Step 5: Create `docs/legal-export/general-privacy.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/general.ts`.

- [ ] **Step 6: Create `docs/legal-export/general-terms.txt`**

Copy the raw HTML string from `src/lib/privacy-policies/general-terms.ts`.

- [ ] **Step 7: Verify files exist**

Run: `ls docs/legal-export/`
Expected output: 6 `.txt` files.

---

### Task 2: Install react-markdown and rehype-sanitize

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Check if already installed**

Run: `grep -E '"react-markdown"|"rehype-sanitize"' package.json`
Expected: no output (neither is installed).

- [ ] **Step 2: Install packages**

Run: `npm install react-markdown rehype-sanitize`

- [ ] **Step 3: Verify installation**

Run: `grep -E '"react-markdown"|"rehype-sanitize"' package.json`
Expected: both packages appear in `dependencies`.

---

### Task 3: Update Convex schema

**Files:**
- Modify: `convex/schema.ts`

Add `termsOfUse` and `privacyPolicy` as optional string fields to the `apps` table.

- [ ] **Step 1: Edit `convex/schema.ts`**

In the `apps` table definition (currently ends at `postHogTrialEvent`), add the two new fields directly after `postHogTrialEvent: v.optional(v.string()),`:

```ts
termsOfUse: v.optional(v.string()),
privacyPolicy: v.optional(v.string()),
```

The `apps` table after the change should look like:

```ts
apps: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    tagline: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    thumbnailStorageId: v.optional(v.id("_storage")),
    slug: v.string(),
    description: v.string(),
    status: v.string(),
    revenueCatProjectId: v.optional(v.string()),
    revenueCatApiKeyEncrypted: v.optional(v.string()),
    postHogProjectId: v.optional(v.string()),
    postHogApiKeyEncrypted: v.optional(v.string()),
    postHogInstallEvent: v.optional(v.string()),
    postHogTrialEvent: v.optional(v.string()),
    termsOfUse: v.optional(v.string()),
    privacyPolicy: v.optional(v.string()),
}),
```

- [ ] **Step 2: Verify Convex picks up the change**

Run: `npx convex dev --once` (or check that the Convex dev server running in the background picks up the schema change without errors).

If the Convex dev server is already running: just confirm no schema errors appear in its output.

---

### Task 4: Update Convex mutations

**Files:**
- Modify: `convex/apps/mutations.ts`

Both `create` and `update` accept optional `termsOfUse` and `privacyPolicy`. Empty string (`""`) means unset the field.

- [ ] **Step 1: Add args to `create` mutation**

In the `create` mutation `args` object (after `thumbnailStorageId`), add:

```ts
termsOfUse: v.optional(v.string()),
privacyPolicy: v.optional(v.string()),
```

- [ ] **Step 2: Pass fields in `create` handler**

In the `ctx.db.insert("apps", { ... })` call, add:

```ts
...(args.termsOfUse ? { termsOfUse: args.termsOfUse } : {}),
...(args.privacyPolicy ? { privacyPolicy: args.privacyPolicy } : {}),
```

This ensures empty strings are never written to the DB.

- [ ] **Step 3: Add args to `update` mutation**

In the `update` mutation `args` object (after `postHogTrialEvent`), add:

```ts
termsOfUse: v.optional(v.string()),
privacyPolicy: v.optional(v.string()),
```

- [ ] **Step 4: Handle empty string clearing in `update` handler**

The existing `update` handler filters out `undefined` values with:
```ts
const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
);
await ctx.db.patch(appId, filteredUpdates);
```

This will pass empty string `""` through to `patch`, which would store it. We need to convert empty strings for these two fields to an explicit unset. Replace the filtering block with:

```ts
const { appId, ...updates } = args;

// Filter out undefined values; convert empty string to field deletion for legal text fields
const filteredUpdates: Record<string, unknown> = {};
for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if ((key === "termsOfUse" || key === "privacyPolicy") && value === "") {
        // Empty string means "clear this field" — use ctx.db.patch with undefined
        // Convex removes a field when patched with undefined
        filteredUpdates[key] = undefined;
    } else {
        filteredUpdates[key] = value;
    }
}

await ctx.db.patch(appId, filteredUpdates as Parameters<typeof ctx.db.patch>[1]);
```

Wait — Convex `patch` does not remove a field by setting it to `undefined` in a plain object. To unset a field in Convex you must not include it in the patch at all, and instead use `ctx.db.replace` or use the `patch` with a special undefined sentinel.

**Correct approach:** Split into two operations:
1. Patch the non-clearing fields
2. For each legal field that is `""`, patch separately with an explicit `undefined`

Actually, Convex does support unsetting a field via `patch` using the special `undefined` value (it removes the key from the document). But TypeScript types may complain. Use type assertion.

Replace the relevant part of the handler with:

```ts
const { appId, ...updates } = args;

// Build the patch object — skip undefined, convert "" to undefined for legal text fields (removes the field)
const patchData: Record<string, unknown> = {};
for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if ((key === "termsOfUse" || key === "privacyPolicy") && value === "") {
        patchData[key] = undefined; // Convex removes the field when patched with undefined
    } else {
        patchData[key] = value;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
await ctx.db.patch(appId, patchData as any);
return appId;
```

- [ ] **Step 5: Verify Convex compiles without errors**

Check the Convex dev server output for TypeScript errors. Alternatively run:
`npx tsc --noEmit` in the `convex/` directory if a tsconfig exists there.

---

### Task 5: Add Legal Texts section to admin panel

**Files:**
- Modify: `src/app/admin/(dashboard)/apps/page.tsx`

Add a "Legal Texts" section below `<AnalyticsConfigForm>` and above the Danger Zone. Extend the form state to include `termsOfUse` and `privacyPolicy`. Pass them in the existing `updateApp` call.

- [ ] **Step 1: Extend `formData` state in `AppSettingsForm`**

Find the `useState` for `formData` (line ~201):
```ts
const [formData, setFormData] = useState({
    name: "",
    domain: "",
    tagline: "",
    description: "",
    status: "live",
    slug: "",
});
```

Change to:
```ts
const [formData, setFormData] = useState({
    name: "",
    domain: "",
    tagline: "",
    description: "",
    status: "live",
    slug: "",
    termsOfUse: "",
    privacyPolicy: "",
});
```

- [ ] **Step 2: Pre-populate new fields in the `useEffect`**

Find the `useEffect` that sets `formData` from `app` (line ~231). Add to the object:
```ts
termsOfUse: app.termsOfUse || "",
privacyPolicy: app.privacyPolicy || "",
```

- [ ] **Step 3: Pass new fields in `updateApp` call**

Find the `await updateApp({ ... })` call in `handleSubmit` (line ~304). Add:
```ts
termsOfUse: formData.termsOfUse,
privacyPolicy: formData.privacyPolicy,
```

These values are already strings (empty string = clear, non-empty = save), which matches the mutation semantics.

- [ ] **Step 4: Add Legal Texts section to the JSX**

Find the closing `</form>` tag (line ~442) followed by:
```tsx
{/* Analytics Config */}
<AnalyticsConfigForm appId={appId} app={app} />
```

After `<AnalyticsConfigForm ... />` and before `{/* Danger Zone */}`, add:

```tsx
{/* Legal Texts */}
<div className="mt-8 bg-surface border border-border rounded-2xl p-8">
    <h2 className="text-xl font-bold mb-1">Legal Texts</h2>
    <p className="text-secondary text-sm mb-6">
        Enter Markdown content for the public Terms of Use and Privacy Policy pages. Leave empty to use the default boilerplate.
    </p>
    <div className="space-y-6">
        <div>
            <label htmlFor="termsOfUse" className="block text-sm font-medium text-secondary mb-1.5">
                Terms of Use
            </label>
            <textarea
                id="termsOfUse"
                value={formData.termsOfUse}
                onChange={(e) => setFormData({ ...formData, termsOfUse: e.target.value })}
                disabled={isSubmitting}
                rows={15}
                placeholder="Enter Markdown content..."
                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
            />
        </div>
        <div>
            <label htmlFor="privacyPolicy" className="block text-sm font-medium text-secondary mb-1.5">
                Privacy Policy
            </label>
            <textarea
                id="privacyPolicy"
                value={formData.privacyPolicy}
                onChange={(e) => setFormData({ ...formData, privacyPolicy: e.target.value })}
                disabled={isSubmitting}
                rows={15}
                placeholder="Enter Markdown content..."
                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
            />
        </div>
    </div>
    <p className="mt-3 text-xs text-muted">Saved via the "Save Changes" button above.</p>
</div>
```

Note: The textareas are inside the `AppSettingsForm` component but rendered outside the `<form>` tag. The save happens via the form's `handleSubmit` which already reads `formData`. This is fine — the state is shared.

Actually, looking at the component structure more carefully: the textareas need to be inside the `<form>` element OR the `handleSubmit` must read from `formData` state (which it does). Since `formData` is component state, the textareas can live anywhere inside `AppSettingsForm` and the save button will pick up their values. Place the Legal Texts section **inside** the `<form>` element, just before the save/cancel button row (`<div className="flex gap-4 mt-8">`).

Revised placement: inside `<form onSubmit={handleSubmit}>`, after the status `<div>` and before `<div className="flex gap-4 mt-8">`, add the two textarea fields directly (without the outer card wrapper, since they're already inside the form card):

```tsx
{/* Terms of Use */}
<div>
    <label htmlFor="termsOfUse" className="block text-sm font-medium text-secondary mb-2">
        Terms of Use <span className="text-muted font-normal">(Markdown)</span>
    </label>
    <textarea
        id="termsOfUse"
        value={formData.termsOfUse}
        onChange={(e) => setFormData({ ...formData, termsOfUse: e.target.value })}
        disabled={isSubmitting}
        rows={15}
        placeholder="Enter Markdown content..."
        className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
    />
    <p className="mt-1 text-xs text-muted">Leave empty to use the default boilerplate. Markdown only — not HTML.</p>
</div>

{/* Privacy Policy */}
<div>
    <label htmlFor="privacyPolicy" className="block text-sm font-medium text-secondary mb-2">
        Privacy Policy <span className="text-muted font-normal">(Markdown)</span>
    </label>
    <textarea
        id="privacyPolicy"
        value={formData.privacyPolicy}
        onChange={(e) => setFormData({ ...formData, privacyPolicy: e.target.value })}
        disabled={isSubmitting}
        rows={15}
        placeholder="Enter Markdown content..."
        className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-y font-mono text-sm disabled:opacity-50"
    />
    <p className="mt-1 text-xs text-muted">Leave empty to use the default boilerplate. Markdown only — not HTML.</p>
</div>
```

- [ ] **Step 5: Verify the admin page renders without TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors related to the new fields.

---

### Task 6: Update public Terms of Use detail page

**Files:**
- Modify: `src/app/terms-of-use/[app]/page.tsx`

Use `getBySlug` query (already imported) to fetch the app, check for `termsOfUse` field, render with `react-markdown` if present, fall back to existing hardcoded branches otherwise.

The page already uses `getBySlug` — but only when `appSlug !== "general"`. For keevio/memolib, `appData` is fetched but the hardcoded branch is rendered before it's used. We'll check `appData?.termsOfUse` first.

- [ ] **Step 1: Add react-markdown import**

At the top of `src/app/terms-of-use/[app]/page.tsx`, add:

```ts
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
```

- [ ] **Step 2: Expand query to also cover "general" slug**

Currently the query skips when `appSlug === "general"`:
```ts
api.apps.queries.getBySlug,
appSlug && appSlug !== "general" ? { slug: appSlug } : "skip"
```

Change to always query when `appSlug` is set (to support a potential "general" app in the DB):
```ts
api.apps.queries.getBySlug,
appSlug ? { slug: appSlug } : "skip"
```

- [ ] **Step 3: Replace the rendering conditional**

Find the current rendering block (line ~42–80):
```tsx
{isKeevio ? (
    <article ... dangerouslySetInnerHTML={{ __html: keevioTermsOfUse }} />
) : isMemoLib ? (
    ...
) : isGeneral ? (
    ...
) : (
    <article>... boilerplate ...</article>
)}
```

Replace with:

```tsx
{appData?.termsOfUse ? (
    <article className="prose prose-invert prose-lg max-w-3xl">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {appData.termsOfUse}
        </ReactMarkdown>
    </article>
) : isKeevio ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: keevioTermsOfUse }}
    />
) : isMemoLib ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: memolibTermsOfUse }}
    />
) : isGeneral ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: generalTermsOfUse }}
    />
) : (
    <article className="prose prose-invert prose-lg max-w-3xl">
        <h1>Terms of Use for {title}</h1>
        <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>
        <h2>1. Scope</h2>
        <p>These terms apply to the usage of {title}. By using our services, you agree to these terms.</p>
        <h2>2. Usage Rules</h2>
        <p>You agree not to misuse the service or attempt to access it using unauthorized methods.</p>
        <h2>3. Subscriptions</h2>
        <p>If the app offers paid subscriptions, they are billed in advance on a recurring basis.</p>
        <h2>4. Termination</h2>
        <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice.</p>
        <h2>5. Liability</h2>
        <p>NorthByte Studio shall not be held liable for indirect, incidental, or consequential damages.</p>
        <h2>6. Governing Law</h2>
        <p>These terms shall be governed by the laws of the jurisdiction in which NorthByte Studio operates.</p>
    </article>
)}
```

Note: `appData` will be `undefined` while loading (Convex returns `undefined` during the query, then the result). The `appData?.termsOfUse` check handles this — during loading it falls through to the hardcoded branch, which is fine.

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no type errors.

---

### Task 7: Update public Privacy Policy detail page

**Files:**
- Modify: `src/app/privacy-policy/[app]/page.tsx`

Same pattern as Task 6, but for `privacyPolicy`.

- [ ] **Step 1: Add react-markdown import**

At the top of `src/app/privacy-policy/[app]/page.tsx`, add:

```ts
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
```

- [ ] **Step 2: Expand query to cover all slugs**

Change:
```ts
appSlug && appSlug !== "general" ? { slug: appSlug } : "skip"
```
To:
```ts
appSlug ? { slug: appSlug } : "skip"
```

- [ ] **Step 3: Replace the rendering conditional**

Replace the current `{isKeevio ? ... : ...}` block with:

```tsx
{appData?.privacyPolicy ? (
    <article className="prose prose-invert prose-lg max-w-3xl">
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {appData.privacyPolicy}
        </ReactMarkdown>
    </article>
) : isKeevio ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: keevioPrivacyPolicy }}
    />
) : isMemoLib ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: memolibPrivacyPolicy }}
    />
) : isGeneral ? (
    <article
        className="prose prose-invert prose-lg max-w-3xl"
        dangerouslySetInnerHTML={{ __html: generalPrivacyPolicy }}
    />
) : (
    <article className="prose prose-invert prose-lg max-w-3xl">
        <h1>Privacy Policy for {title}</h1>
        <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>
        <h2>1. Responsible Entity</h2>
        <p>NorthByte Studio is responsible for the data processing on this {isGeneral ? "website" : "application"}.</p>
        <h2>2. Data Collection</h2>
        <p>We collect minimal data necessary to provide our services. {isGeneral ? "For website visitors, this may include IP addresses and standard web logs." : "For app users, this depends on the specific features used."}</p>
        <h2>3. Analytics</h2>
        <p>We may use anonymous analytics to improve our products. No personally identifiable information is traded.</p>
        <h2>4. Third Parties</h2>
        <p>We do not share data with third parties unless required by law or for core functional services (e.g. hosting).</p>
        <h2>5. User Rights</h2>
        <p>You have the right to request information about your stored data at any time.</p>
        <h2>6. Contact</h2>
        <p>If you have questions, reach out via our contact form.</p>
    </article>
)}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no type errors.

---

### Task 8: Manual smoke test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test admin panel**

Navigate to `http://localhost:3000/admin/apps`.
- Select an app
- Scroll down — confirm the two new textarea fields appear (Terms of Use, Privacy Policy) inside the app settings form
- Type some markdown (e.g. `# Hello\n\nThis is a **test**.`) into the Terms of Use field
- Click "Save Changes"
- Confirm no error appears, the save succeeds

- [ ] **Step 3: Test public page renders markdown**

Navigate to `http://localhost:3000/terms-of-use/<slug>` (the slug of the app you just saved).
- Confirm the markdown renders as HTML (h1, bold text, etc.)
- Confirm the `prose` styling applies correctly

- [ ] **Step 4: Test fallback still works**

Navigate to `http://localhost:3000/terms-of-use/keevio` (or another app without DB content).
- Confirm the hardcoded HTML content still renders as before.

- [ ] **Step 5: Test clearing**

In the admin panel, clear the Terms of Use textarea and save.
- Navigate back to the public page — confirm it falls back to boilerplate.

- [ ] **Step 6: Test privacy policy page**

Repeat Steps 2–5 for `http://localhost:3000/privacy-policy/<slug>`.
