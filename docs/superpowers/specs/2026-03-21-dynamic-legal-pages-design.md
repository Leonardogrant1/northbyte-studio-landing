# Dynamic Legal Pages Design

**Date:** 2026-03-21
**Status:** Approved

## Overview

Make Terms of Use and Privacy Policy pages dynamically loaded from the database. Admins can edit the markdown content per app in the admin panel. Existing hardcoded content is exported as `.txt` files (in `docs/legal-export/`) for manual re-entry as markdown. The hardcoded branches remain in place as fallback until DB fields are populated.

## Schema Changes

Add two optional fields to the `apps` table in `convex/schema.ts`:

```ts
termsOfUse: v.optional(v.string()),
privacyPolicy: v.optional(v.string()),
```

## Backend Changes

**`convex/apps/mutations.ts`**

Both `create` and `update` mutations accept optional `termsOfUse` and `privacyPolicy` string params with the same semantics:

- Non-empty string → save/update the field on the document
- Empty string (`""`) → explicitly **unset** the field (removes it from the document, reverting public pages to the hardcoded fallback). This is the mechanism for clearing previously-set content.
- `undefined` / not provided → leave the existing field value unchanged (update only; create simply omits the field)

**Query:** `getBySlugForPublic` returns full app documents without field projection — new optional fields are automatically included when present. No query changes required.

## Admin Panel Changes

**`/admin/apps` page**

- Legal Texts section is shown only when an app is selected (`selectedAppId` is set), consistent with other sections
- New "Legal Texts" section below Analytics Configuration with two `<textarea>` fields (~15 rows each):
  - Terms of Use (markdown)
  - Privacy Policy (markdown)
- Placeholder: `"Enter Markdown content..."`
- Implementation: extend the existing form state object to include `termsOfUse` and `privacyPolicy` string fields, pre-populated from the current app document. Pass them in the same `update` mutation call as all other app fields. No separate mutation or save handler needed.
- On mutation failure: existing error handling (toast/alert) applies

## Public Pages Changes

**`/terms-of-use/[app]` and `/privacy-policy/[app]`**

Rendering priority:
1. Slug not found in DB → `notFound()` (Next.js 404)
2. DB field present and non-empty → render with `react-markdown` + `rehype-sanitize` (default schema)
3. DB field absent or empty → existing hardcoded HTML branches (keevio, memolib, general) or boilerplate template (unchanged)

Hardcoded branches remain in place until the admin manually populates DB fields.

Loading and error states: deferred to Next.js + Convex framework defaults.

**Dependencies to install** (check `package.json` first; install if not present):
- `react-markdown`
- `rehype-sanitize`

> Admins must enter **markdown**, not HTML. The exported `.txt` files are HTML source — admins must convert to markdown before pasting into the textarea.

## Content Export

Existing hardcoded HTML content exported to `docs/legal-export/` as `.txt` reference files. Committed to source control.

Files:
- `docs/legal-export/keevio-terms.txt`
- `docs/legal-export/keevio-privacy.txt`
- `docs/legal-export/memolib-terms.txt`
- `docs/legal-export/memolib-privacy.txt`
- `docs/legal-export/general-terms.txt`
- `docs/legal-export/general-privacy.txt`

## Non-Goals

- Markdown preview in admin
- Version history or audit trail
- Multi-language support
- Separate `legalTexts` table
- Automated HTML-to-markdown migration
- `rehype-raw` for HTML passthrough
- Client-side size validation
