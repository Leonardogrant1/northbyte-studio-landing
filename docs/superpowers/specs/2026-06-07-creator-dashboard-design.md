# Creator Dashboard & Admin Analytics Protection

**Date:** 2026-06-07  
**Status:** Approved

---

## Overview

Two related goals:

1. **Admin analytics are already route-guarded** via `RoleGuard`, but the analytics API routes (`/api/analytics/...`) lack a role check — any authenticated user can call them directly. Add an explicit `admin`-only check to those routes.
2. **Creators currently have no landing page** — when they try to access `/admin` they get silently redirected to `/admin/media`. Give them a proper dashboard at `/admin/creator-dashboard` showing their own post stats.

---

## Scope

### In scope
- New page: `/admin/creator-dashboard`
- New Convex query: `posts.queries.getMyPostStats` (post counts by status for current user)
- Update `RoleGuard`: redirect creators from admin-only routes to `/admin/creator-dashboard` instead of `/admin/media`
- Update `AdminSidebar`: add a `creatorOnly` flag concept; show "Dashboard" → `/admin/creator-dashboard` for creators
- Add role check to analytics API routes: `/api/analytics/overview/route.ts`, `/api/analytics/apps/[appId]/route.ts`, `/api/analytics/expenses/route.ts`, `/api/analytics/profit/route.ts`

### Out of scope
- Time-series charts or engagement analytics for creators (future work)
- Any changes to the admin analytics dashboard itself
- Creator-specific social account assignment UI

---

## Architecture

### 1. Analytics API — Role Enforcement

**Files:** `src/app/api/analytics/overview/route.ts`, `src/app/api/analytics/apps/[appId]/route.ts`, `src/app/api/analytics/expenses/route.ts`, `src/app/api/analytics/profit/route.ts`

Each route currently checks only `getAuthenticatedUserId()`. After this change, they will additionally query Convex for the user's role and return `403` if the role is not `admin`.

Pattern (same for all four routes — mirrors the existing pattern in `/admin/(dashboard)/page.tsx`):
```ts
const { userId, getToken } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

const token = await getToken({ template: "convex" });
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

convex.setAuth(token);
const user = await convex.query(api.users.queries.getCurrentUser, {});
if (!user || user.type !== "admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

> `getCurrentUser` (in `convex/users/queries.ts`) takes no args and resolves the user from the Convex auth context set via `convex.setAuth(token)`. The `getAuthenticatedUserId()` helper can be dropped from these routes — `auth()` covers it.  
> The `convex` instance in each route is already module-level; `setAuth` is safe to call per-request since it only sets a token on the instance for that invocation.

### 2. New Convex Query — `getMyPostStats`

**File:** `convex/posts/queries.ts`

Aggregates post counts by status for the authenticated user (respects the same admin/creator split as `getMyPosts`).

```ts
export const getMyPostStats = query({
  args: {},
  handler: async (ctx) => {
    // fetch all posts for current user (same logic as getMyPosts)
    // reduce to: { ready_to_post: number, scheduled: number, posted: number, failed: number }
  },
});
```

Returns:
```ts
{
  ready_to_post: number;
  scheduled: number;
  posted: number;
  failed: number;
  total: number;
}
```

### 3. Creator Dashboard Page

**File:** `src/app/admin/(dashboard)/creator-dashboard/page.tsx`

Server component. No server-side role guard needed (RoleGuard in the layout handles unauthorized access).

Layout:
```
┌─────────────────────────────────────────────┐
│  Hi, {name}                                  │
│  Here's an overview of your content.         │
├──────────┬──────────┬──────────┬────────────┤
│ Ready    │ Scheduled│ Posted   │ Failed     │
│  [count] │  [count] │  [count] │  [count]  │
├─────────────────────────────────────────────┤
│  Recent Posts (last 5)                       │
│  [title] [platform emoji] [status] [time]    │
│  ...                                         │
├─────────────────────────────────────────────┤
│  More analytics coming soon.                 │
└─────────────────────────────────────────────┘
```

Data sources:
- Stat cards: `api.posts.queries.getMyPostStats` (new query)
- Recent posts: `api.posts.queries.getRecent` with `limit: 5` (already exists)

### 4. RoleGuard Update

**File:** `src/components/admin/RoleGuard.tsx`

Change line 39:
```ts
// Before
router.replace("/admin/media");

// After
router.replace("/admin/creator-dashboard");
```

Also add `/admin/creator-dashboard` to the allowed-for-creator set so the guard doesn't loop:

```ts
// New: creator-allowed exact routes (not admin-only, not affiliate-only)
const CREATOR_HOME = "/admin/creator-dashboard";
```

The guard already passes through non-admin-only routes for creators — `/admin/creator-dashboard` will just work as long as it is not listed in `ADMIN_ONLY_PREFIXES` or `ADMIN_ONLY_EXACT`.

### 5. AdminSidebar Update

**File:** `src/components/admin/AdminSidebar.tsx`

Add a `creatorOnly` flag to the tab definition type. Add one new tab entry:

```ts
{
  label: "Dashboard",
  icon: LayoutDashboard,   // from lucide-react
  href: "/admin/creator-dashboard",
  isActive: pathname === "/admin/creator-dashboard",
  adminOnly: false,
  affiliateOnly: false,
  creatorOnly: true,
}
```

Update the filter logic:
```ts
const tabs = allTabs.filter((tab) => {
  if (user === undefined || user === null) return false;
  if (isAffiliate) return tab.affiliateOnly === true;
  if (isCreator) return !tab.adminOnly && !tab.affiliateOnly;
  // admin: show everything except affiliateOnly and creatorOnly
  if (isAdmin) return !tab.affiliateOnly && !tab.creatorOnly;
  return false;
});
```

This means:
- **Admin** sees: Analytics, Bugs, Features, Apps, Media, AI-Lab, Post Content, Contents, Social Accounts, AI Avatars, User & Roles — same as today
- **Creator** sees: Media, AI-Lab, Post Content, Contents, **Dashboard** (new)
- **Affiliate** sees: Dashboard (affiliate) — same as today

---

## Files Changed

| File | Change |
|------|--------|
| `convex/posts/queries.ts` | Add `getMyPostStats` query |
| `src/app/admin/(dashboard)/creator-dashboard/page.tsx` | New page (create) |
| `src/components/admin/RoleGuard.tsx` | Redirect creator to `/admin/creator-dashboard` |
| `src/components/admin/AdminSidebar.tsx` | Add `creatorOnly` tab + filter logic |
| `src/app/api/analytics/overview/route.ts` | Add admin role check |
| `src/app/api/analytics/apps/[appId]/route.ts` | Add admin role check |
| `src/app/api/analytics/expenses/route.ts` | Add admin role check |
| `src/app/api/analytics/profit/route.ts` | Add admin role check |

---

## Error Handling

- Analytics API routes return `{ error: "Forbidden" }` with status `403` if user is not admin. Frontend already handles non-2xx responses from these routes.
- Creator dashboard: if `getMyPostStats` or `getRecent` return loading state, show skeleton cards (same pattern used elsewhere in the admin UI).

---

## Testing

- Log in as creator → redirected to `/admin/creator-dashboard`, see stat cards and recent posts
- Log in as creator → direct GET to `/api/analytics/overview` returns 403
- Log in as admin → `/admin` analytics unchanged, all API routes still work
- Log in as affiliate → redirect to `/admin/affiliate` unchanged
- Creator sidebar shows: Media, AI-Lab, Post Content, Contents, Dashboard
- Admin sidebar unchanged
