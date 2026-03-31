# Creator Interface Design

**Date:** 2026-03-30
**Branch:** feat/creator-interface
**Status:** Approved

---

## Overview

Extend the admin dashboard with a role-based access system. Introduce a `creator` role alongside the existing `admin` role. Creators get access to three new pages (Media, AI-Lab, Post Content) but cannot access Analytics, Apps, Bugs, or Features. Admins can invite users via a new User & Roles page, assigning roles before sign-up. The existing `@northbyte.studio` email domain restriction is removed.

---

## 1. Database Schema Changes

### `users` table — add `type` field

```ts
users: defineTable({
  clerkId: v.string(),
  email: v.optional(v.string()),
  type: v.union(v.literal("admin"), v.literal("creator")),  // NEW
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_clerk", ["clerkId"])
```

**Migration:** Existing `@northbyte.studio` users have no `type` field. The `createUser` mutation checks the email domain on first creation and sets `type: "admin"` for `@northbyte.studio` addresses as a one-time fallback.

### `user_invites` table — new

```ts
user_invites: defineTable({
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("creator")),
  invitedBy: v.id("users"),
  createdAt: v.number(),
  usedAt: v.optional(v.number()),  // undefined = pending, timestamp = redeemed
}).index("by_email", ["email"])
```

---

## 2. Authentication Flow

### Sign-up (`/admin/signup`)

1. User submits email + password
2. Before creating Clerk account: call Convex query `getInviteByEmail(email)`
3. No invite found → show error: *"Du wurdest nicht eingeladen."*
4. Invite found and `usedAt` is set → show error: *"Diese Einladung wurde bereits verwendet."*
5. Valid invite → create Clerk account → call `createUser` with `type` from invite → set `usedAt` on invite → redirect to dashboard

### Login (`/admin/login`)

- Remove `@northbyte.studio` domain restriction entirely
- Standard Clerk email + password login
- After login: fetch `getCurrentUser` from Convex to determine role

### Dashboard layout (`layout.tsx`)

- Server-side: keep Clerk `auth()` check — if not authenticated, redirect to `/admin/login`
- Client-side (`AdminSidebar` / page-level): fetch role via `getCurrentUser` Convex query
- Creators who land on admin-only routes are redirected client-side (in a `RoleGuard` client component) to `/admin/media`
- Role passed to sidebar for conditional nav rendering

---

## 3. Role-Based Navigation

### Sidebar visibility

| Page          | Admin | Creator |
|---------------|-------|---------|
| Analytics     | ✅    | ❌      |
| Bugs          | ✅    | ❌      |
| Features      | ✅    | ❌      |
| Apps          | ✅    | ❌      |
| Media         | ✅    | ✅      |
| AI-Lab        | ✅    | ✅      |
| Post Content  | ✅    | ✅      |
| User & Roles  | ✅    | ❌      |

`AdminSidebar.tsx` receives the current user's role as a prop and conditionally renders nav items.

### Route guard

Creators who navigate directly to `/admin`, `/admin/bugs`, `/admin/features`, `/admin/apps`, or `/admin/users` are redirected to `/admin/media`.

---

## 4. New Pages

All three creator pages are placeholder/dummy implementations for now. Content will be defined later.

| Route              | Page           | Access        |
|--------------------|----------------|---------------|
| `/admin/media`     | Media          | admin, creator |
| `/admin/ai-lab`    | AI-Lab         | admin, creator |
| `/admin/post-content` | Post Content | admin, creator |
| `/admin/users`     | User & Roles   | admin only    |

---

## 5. User & Roles Page (`/admin/users`)

Admin-only page for managing invitations and viewing active users.

### Invite form
- Email input + role dropdown (`admin` / `creator`) + "Einladen" button
- Creates entry in `user_invites` table
- No email sending for now — invite is purely DB-based

### Open invitations table
- Columns: Email, Rolle, Eingeladen am, Status (`Offen` / `Eingelöst`)
- Action: revoke invite (delete row) — only for `Offen` invites

### Active users table
- Columns: Email, Rolle, Registriert am
- Shows all users currently in the `users` table

---

## 6. Convex Backend Changes

### New queries
- `user_invites/queries.ts`: `getByEmail(email)` — returns open invite for email
- `user_invites/queries.ts`: `getAll()` — returns all invites (for admin page)

### New mutations
- `user_invites/mutations.ts`: `create({ email, role, invitedBy })` — creates invite
- `user_invites/mutations.ts`: `redeem(inviteId)` — sets `usedAt` timestamp
- `user_invites/mutations.ts`: `remove(inviteId)` — deletes invite (revoke)

### Modified mutations
- `users/mutations.ts`: `createUser` — add `type` field, add `@northbyte.studio` fallback logic

### Modified queries
- `users/queries.ts`: `getCurrentUser` — include `type` field in return value

---

## 7. Files to Change

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `type` to `users`, add `user_invites` table |
| `convex/users/mutations.ts` | Add `type` param + northbyte fallback |
| `convex/users/queries.ts` | Return `type` in `getCurrentUser` |
| `convex/users/webhooks.ts` | Pass `type` through webhook flow |
| `convex/user_invites/queries.ts` | New file |
| `convex/user_invites/mutations.ts` | New file |
| `src/lib/auth.ts` | Remove/replace `isAdmin()` with role-based check |
| `src/lib/auth-utils.ts` | Remove `isNorthByteEmail()` |
| `src/app/admin/signup/page.tsx` | Add invite check before sign-up |
| `src/app/admin/login/page.tsx` | Remove domain restriction |
| `src/app/admin/(dashboard)/layout.tsx` | Keep Clerk auth check server-side; add `RoleGuard` client component |
| `src/components/admin/RoleGuard.tsx` | New client component — fetches role, redirects creators away from admin-only routes |
| `src/components/admin/AdminSidebar.tsx` | Role-based nav rendering |
| `src/app/admin/(dashboard)/media/page.tsx` | New dummy page |
| `src/app/admin/(dashboard)/ai-lab/page.tsx` | New dummy page |
| `src/app/admin/(dashboard)/post-content/page.tsx` | New dummy page |
| `src/app/admin/(dashboard)/users/page.tsx` | New User & Roles page |
