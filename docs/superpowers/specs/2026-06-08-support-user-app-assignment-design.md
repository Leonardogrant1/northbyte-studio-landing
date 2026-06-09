# Support User Type + App Assignment — Design Spec

**Date:** 2026-06-08  
**Scope:** New "support" user role, app assignment relation, admin UI in User & Roles tab, support route placeholder.

---

## Overview

Add a `support` user type to the system. Admins can assign one or more apps to support users via the existing User & Roles admin tab. Support users are redirected to a new `/admin/support` route after login. Admins also retain access to that route.

---

## 1. Schema Changes (`convex/schema.ts`)

### User type union
Extend the `type` field on the `users` table:
```
v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support"))
```

### `user_invites` role union
Extend the `role` field in `user_invites` to also include `"support"`.

### New table: `support_assignments`
```ts
support_assignments: defineTable({
  userId: v.id("users"),
  appId:  v.id("apps"),
})
  .index("by_user", ["userId"])
  .index("by_app",  ["appId"])
```

---

## 2. Convex Backend

### `convex/support_assignments/mutations.ts`

- **`assign({ userId, appId })`**
  - Caller must be admin (throw if not)
  - Idempotent: no-op if entry already exists
  - Creates `{ userId, appId }` document

- **`unassign({ userId, appId })`**
  - Caller must be admin (throw if not)
  - Deletes the matching document (no-op if not found)

### `convex/support_assignments/queries.ts`

- **`getAppsForUser({ userId })`**
  - Returns all app documents assigned to the given support user
  - Uses `by_user` index

- **`getUsersForApp({ appId })`**
  - Returns all user documents assigned to the given app
  - Uses `by_app` index (useful for the ticket phase)

All mutations follow the existing admin-guard pattern:
```ts
const caller = await ctx.db.query("users")
  .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
  .first();
if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
```

---

## 3. UI — User & Roles Tab (`/admin/users`)

### Invite Form
Add `"support"` as a new option to the role `<select>` dropdown. No additional fields required (unlike affiliate which has commission fields).

### New Section: "Support Users"
Added below the existing Active Users table. Shows a table with columns:
- Name / E-Mail
- Assigned Apps (rendered as badges)
- Action button: "Apps verwalten"

### "Apps verwalten" Modal
- Lists all apps (from existing `apps` table) with checkboxes
- Pre-checks currently assigned apps (loaded via `getAppsForUser`)
- On save: computes diff (added/removed), calls `assign`/`unassign` for each change
- Modal is inline on the page, no separate route

---

## 4. RoleGuard & Routing

### Support user redirect
In `RoleGuard`, support users are redirected to `/admin/support` instead of being blocked.

### `/admin/support` — Placeholder Page
- New Next.js route: `src/app/admin/(dashboard)/support/page.tsx`
- Content: Page title "Support" + text "Coming soon"
- No auth logic beyond what the layout already handles

### Access rules for `/admin/support`
- `/admin/support` is **not** added to `ADMIN_ONLY_PREFIXES` (that would block support users)
- Instead, `RoleGuard` explicitly allows both `admin` and `support` types to access `/admin/support/*`
- All other existing admin-only routes remain inaccessible to support users

---

## Out of Scope (this phase)

- Actual ticket management UI/functionality
- Support user permissions beyond routing
- Notifications or assignment emails
