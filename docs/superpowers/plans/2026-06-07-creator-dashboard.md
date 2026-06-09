# Creator Dashboard & Admin Analytics Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give creators their own dashboard at `/admin/creator-dashboard` showing post stats, and harden analytics API routes so only admins can call them.

**Architecture:** Add a `getMyPostStats` Convex query that aggregates post counts by status for the current user. Create the creator dashboard page as a client component following the affiliate dashboard pattern. Update `RoleGuard` and `AdminSidebar` to route/show creators to their dashboard. Add `auth()` + `convex.setAuth()` role checks to the four analytics API routes.

**Tech Stack:** Next.js 14 App Router, Convex (server-side DB + queries), Clerk (auth), Lucide icons, Tailwind CSS

---

## File Map

| File | Action |
|------|--------|
| `convex/posts/queries.ts` | Add `getMyPostStats` query |
| `src/app/admin/(dashboard)/creator-dashboard/page.tsx` | Create new page |
| `src/components/admin/RoleGuard.tsx` | Change creator redirect target |
| `src/components/admin/AdminSidebar.tsx` | Add `creatorOnly` tab + update filter |
| `src/app/api/analytics/overview/route.ts` | Replace auth check with role check |
| `src/app/api/analytics/apps/[appId]/route.ts` | Replace auth check with role check |
| `src/app/api/analytics/expenses/route.ts` | Replace auth check with role check |
| `src/app/api/analytics/profit/route.ts` | Replace auth check with role check |

---

### Task 1: Add `getMyPostStats` Convex query

**Files:**
- Modify: `convex/posts/queries.ts`

- [ ] **Step 1: Add `getMyPostStats` to `convex/posts/queries.ts`**

Append after the last export in the file:

```ts
// Returns post counts grouped by status for the current user.
// Admin sees counts across all posts; creator sees only their own.
export const getMyPostStats = query({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
            .first();
        if (!user) throw new Error("User not found.");

        let posts;
        if (user.type === "admin") {
            posts = await ctx.db.query("posts").collect();
        } else {
            posts = await ctx.db
                .query("posts")
                .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
                .collect();
        }

        const stats = { ready_to_post: 0, scheduled: 0, posted: 0, failed: 0, total: 0 };
        for (const post of posts) {
            stats.total++;
            if (post.status === "ready_to_post") stats.ready_to_post++;
            else if (post.status === "scheduled") stats.scheduled++;
            else if (post.status === "posted") stats.posted++;
            else if (post.status === "failed") stats.failed++;
        }
        return stats;
    },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `convex/posts/queries.ts`

- [ ] **Step 3: Commit**

```bash
git add convex/posts/queries.ts
git commit -m "feat: add getMyPostStats Convex query for creator dashboard"
```

---

### Task 2: Harden analytics API routes with admin role check

**Files:**
- Modify: `src/app/api/analytics/overview/route.ts`
- Modify: `src/app/api/analytics/apps/[appId]/route.ts`
- Modify: `src/app/api/analytics/expenses/route.ts`
- Modify: `src/app/api/analytics/profit/route.ts`

The pattern is identical for all four files. Each currently has:
```ts
import { getAuthenticatedUserId } from "@/lib/auth";
// ...
if (!(await getAuthenticatedUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

Replace this with Clerk `auth()` + Convex role check (same pattern as `/admin/(dashboard)/page.tsx`).

- [ ] **Step 4: Update `src/app/api/analytics/overview/route.ts`**

Replace the import of `getAuthenticatedUserId` and the auth check block:

```ts
// Remove this import:
import { getAuthenticatedUserId } from "@/lib/auth";

// Add this import at the top alongside existing imports:
import { auth } from "@clerk/nextjs/server";
```

Replace the auth guard (currently `if (!(await getAuthenticatedUserId())) { ... }`) with:

```ts
export async function GET(request: NextRequest) {
    const { userId, getToken } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const token = await getToken({ template: "convex" });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    convex.setAuth(token);
    const currentUser = await convex.query(api.users.queries.getCurrentUser, {});
    if (!currentUser || currentUser.type !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ... rest of existing handler unchanged
```

Full updated file:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { getRangeDates, Range } from "../apps/[appId]/helpers/dates";
import { rcFetch } from "../apps/[appId]/helpers/revenuecat";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface OverviewResult {
    currency: string;
    totalRevenue: number;
    totalProceeds: number;
    appCount: number;
}

export async function GET(request: NextRequest) {
    const { userId, getToken } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const token = await getToken({ template: "convex" });
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    convex.setAuth(token);
    const currentUser = await convex.query(api.users.queries.getCurrentUser, {});
    if (!currentUser || currentUser.type !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const range = (sp.get("range") ?? "7d") as Range;
    const fromParam = sp.get("from") ?? undefined;
    const toParam = sp.get("to") ?? undefined;
    const currency = sp.get("currency") ?? "USD";

    const apps = await convex.query(api.apps.queries.getAll);
    const { startDate, endDate } = getRangeDates(range, fromParam, toParam);

    const proceedsSelector = `&selectors=${encodeURIComponent(JSON.stringify({ revenue_type: "proceeds" }))}`;

    const results = await Promise.all(
        apps.map(async (app) => {
            if (!app.revenueCatProjectId || !app.revenueCatApiKeyEncrypted) return null;

            const rcKey = decrypt(app.revenueCatApiKeyEncrypted);
            const baseParams = `?start_date=${startDate}&end_date=${endDate}&period=day&currency=USD&realtime=false`;

            const [metricsData, proceedsData] = await Promise.all([
                rcFetch(`/projects/${app.revenueCatProjectId}/charts/revenue${baseParams}`, rcKey).catch(() => null),
                rcFetch(`/projects/${app.revenueCatProjectId}/charts/revenue${baseParams}${proceedsSelector}`, rcKey).catch(() => null),
            ]);

            if (!metricsData) return null;

            return {
                gross: metricsData?.summary?.total?.Revenue ?? 0,
                proceeds: proceedsData?.summary?.total?.Proceeds ?? 0,
            };
        })
    );

    const validResults = results.filter((r): r is { gross: number; proceeds: number } => r !== null);
    const totalRevenueUsd = validResults.reduce((sum, r) => sum + r.gross, 0);
    const totalProceedsUsd = validResults.reduce((sum, r) => sum + r.proceeds, 0);

    let totalRevenue = totalRevenueUsd;
    let totalProceeds = totalProceedsUsd;
    if (currency !== "USD") {
        const fx = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${currency}`);
        const fxData = await fx.json() as { rates: Record<string, number> };
        const rate = fxData.rates[currency] ?? 1;
        totalRevenue = Math.round(totalRevenueUsd * rate * 100) / 100;
        totalProceeds = Math.round(totalProceedsUsd * rate * 100) / 100;
    }

    return NextResponse.json({
        currency,
        totalRevenue,
        totalProceeds,
        appCount: validResults.length,
    } satisfies OverviewResult);
}
```

- [ ] **Step 5: Update `src/app/api/analytics/apps/[appId]/route.ts`**

Read the current file first to get the full handler, then replace only the auth section at lines 35–37:

```ts
// Remove:
import { getAuthenticatedUserId } from "@/lib/auth";

// Add:
import { auth } from "@clerk/nextjs/server";
```

Replace the auth guard block at the top of `GET`:
```ts
// Remove:
if (!(await getAuthenticatedUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

// Replace with:
const { userId, getToken } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

const token = await getToken({ template: "convex" });
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

convex.setAuth(token);
const currentUser = await convex.query(api.users.queries.getCurrentUser, {});
if (!currentUser || currentUser.type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

- [ ] **Step 6: Update `src/app/api/analytics/expenses/route.ts`**

Same replacement as Step 5. Remove `getAuthenticatedUserId` import, add `auth` import, replace the auth guard:

```ts
// Remove:
import { getAuthenticatedUserId } from "@/lib/auth";

// Add:
import { auth } from "@clerk/nextjs/server";
```

```ts
// Remove:
if (!(await getAuthenticatedUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

// Replace with:
const { userId, getToken } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

const token = await getToken({ template: "convex" });
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

convex.setAuth(token);
const currentUser = await convex.query(api.users.queries.getCurrentUser, {});
if (!currentUser || currentUser.type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

- [ ] **Step 7: Update `src/app/api/analytics/profit/route.ts`**

Same replacement as Steps 5–6:

```ts
// Remove:
import { getAuthenticatedUserId } from "@/lib/auth";

// Add:
import { auth } from "@clerk/nextjs/server";
```

```ts
// Remove:
if (!(await getAuthenticatedUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}

// Replace with:
const { userId, getToken } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

const token = await getToken({ template: "convex" });
if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

convex.setAuth(token);
const currentUser = await convex.query(api.users.queries.getCurrentUser, {});
if (!currentUser || currentUser.type !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the four modified route files.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/analytics/overview/route.ts \
        src/app/api/analytics/apps/[appId]/route.ts \
        src/app/api/analytics/expenses/route.ts \
        src/app/api/analytics/profit/route.ts
git commit -m "feat: restrict analytics API routes to admin role only"
```

---

### Task 3: Update RoleGuard — redirect creator to creator dashboard

**Files:**
- Modify: `src/components/admin/RoleGuard.tsx`

Current code (line 39):
```ts
router.replace("/admin/media");
```
And (line 48):
```ts
if (user?.type === "creator" && isAdminOnlyRoute(pathname)) return null;
```

- [ ] **Step 10: Update `src/components/admin/RoleGuard.tsx`**

Replace the entire file content with:

```ts
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Routes that only admins can access (matched as prefix)
const ADMIN_ONLY_PREFIXES = ["/admin/bugs", "/admin/features", "/admin/apps", "/admin/users", "/admin/social-accounts", "/admin/ai-avatars"];
// /admin root is an exact match to avoid false positives on /admin/media, /admin/ai-lab, etc.
const ADMIN_ONLY_EXACT = ["/admin"];

function isAdminOnlyRoute(pathname: string): boolean {
    if (ADMIN_ONLY_EXACT.includes(pathname)) return true;
    return ADMIN_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

// Affiliates can only access their own dashboard
function isAffiliateAllowedRoute(pathname: string): boolean {
    return pathname === "/admin/affiliate" || pathname.startsWith("/admin/affiliate/");
}

interface RoleGuardProps {
    children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useCurrentUser();

    useEffect(() => {
        // Wait until user is loaded
        if (user === undefined) return;

        // If no user in DB yet (rare race condition), do nothing — layout already checked Clerk auth
        if (user === null) return;

        if (user.type === "creator" && isAdminOnlyRoute(pathname)) {
            router.replace("/admin/creator-dashboard");
        }

        if (user.type === "affiliate" && !isAffiliateAllowedRoute(pathname)) {
            router.replace("/admin/affiliate");
        }
    }, [user, pathname, router]);

    // Show nothing while redirecting to avoid flash
    if (user?.type === "creator" && isAdminOnlyRoute(pathname)) return null;
    if (user?.type === "affiliate" && !isAffiliateAllowedRoute(pathname)) return null;

    return <>{children}</>;
}
```

- [ ] **Step 11: Commit**

```bash
git add src/components/admin/RoleGuard.tsx
git commit -m "feat: redirect creator from admin routes to creator dashboard"
```

---

### Task 4: Update AdminSidebar — add creator-only Dashboard tab

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`

The sidebar currently has no `creatorOnly` concept. We add it and update the filter to exclude creator-only tabs from admins and admin-only tabs from creators.

- [ ] **Step 12: Update `src/components/admin/AdminSidebar.tsx`**

Replace the entire file content with:

```ts
"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { BarChart2, Bug, Lightbulb, AppWindow, Image, FlaskConical, FileEdit, Users, AtSign, Bot, LayoutList, TrendingUp, LayoutDashboard } from "lucide-react";
import { Suspense } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function AdminSidebarInner() {
    const pathname = usePathname();
    const params = useParams();
    const searchParams = useSearchParams();
    const user = useCurrentUser();

    const appIdFromRoute = params?.appId as string | undefined;
    const appIdFromQuery = searchParams.get("app");
    const currentAppId = appIdFromRoute || appIdFromQuery;
    const appQuery = currentAppId ? `?app=${currentAppId}` : "";

    const isAdmin = user?.type === "admin";
    const isAffiliate = user?.type === "affiliate";
    const isCreator = user?.type === "creator";

    const allTabs = [
        {
            label: "Analytics",
            icon: BarChart2,
            href: `/admin${appQuery}`,
            isActive: pathname === "/admin",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Bugs",
            icon: Bug,
            href: `/admin/bugs${appQuery}`,
            isActive: pathname === "/admin/bugs",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Features",
            icon: Lightbulb,
            href: `/admin/features${appQuery}`,
            isActive: pathname === "/admin/features",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Apps",
            icon: AppWindow,
            href: `/admin/apps${appQuery}`,
            isActive: pathname === "/admin/apps",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Media",
            icon: Image,
            href: "/admin/media",
            isActive: pathname === "/admin/media",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "AI-Lab",
            icon: FlaskConical,
            href: "/admin/ai-lab",
            isActive: pathname === "/admin/ai-lab",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Post Content",
            icon: FileEdit,
            href: "/admin/post-content",
            isActive: pathname === "/admin/post-content",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Contents",
            icon: LayoutList,
            href: "/admin/contents",
            isActive: pathname === "/admin/contents",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Social Accounts",
            icon: AtSign,
            href: "/admin/social-accounts",
            isActive: pathname === "/admin/social-accounts",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "AI Avatars",
            icon: Bot,
            href: "/admin/ai-avatars",
            isActive: pathname === "/admin/ai-avatars",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "User & Roles",
            icon: Users,
            href: "/admin/users",
            isActive: pathname === "/admin/users",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
        {
            label: "Dashboard",
            icon: TrendingUp,
            href: "/admin/affiliate",
            isActive: pathname === "/admin/affiliate",
            adminOnly: false,
            affiliateOnly: true,
            creatorOnly: false,
        },
        {
            label: "Dashboard",
            icon: LayoutDashboard,
            href: "/admin/creator-dashboard",
            isActive: pathname === "/admin/creator-dashboard",
            adminOnly: false,
            affiliateOnly: false,
            creatorOnly: true,
        },
    ];

    const tabs = allTabs.filter((tab) => {
        if (user === undefined || user === null) return false;
        if (isAffiliate) return tab.affiliateOnly === true;
        if (isCreator) return !tab.adminOnly && !tab.affiliateOnly;
        if (isAdmin) return !tab.affiliateOnly && !tab.creatorOnly;
        return false;
    });

    return (
        <aside className="w-56 shrink-0 border-r border-border p-4">
            <nav className="space-y-1">
                {tabs.map(({ label, icon: Icon, href, isActive }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            isActive
                                ? "bg-accent/10 text-accent"
                                : "text-secondary hover:bg-surface2 hover:text-primary"
                        }`}
                    >
                        <Icon size={18} />
                        <span className="font-medium">{label}</span>
                    </Link>
                ))}
            </nav>
        </aside>
    );
}

export function AdminSidebar() {
    return (
        <Suspense fallback={<aside className="w-56 shrink-0 border-r border-border" />}>
            <AdminSidebarInner />
        </Suspense>
    );
}
```

> Note on the filter logic for creators: `!tab.adminOnly && !tab.affiliateOnly` shows all general-access tabs plus the creator-only Dashboard tab (since `creatorOnly: true` satisfies this condition — it's not adminOnly, not affiliateOnly). The `creatorOnly` flag only blocks admins from seeing the tab.

- [ ] **Step 13: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `AdminSidebar.tsx`.

- [ ] **Step 14: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat: add creator-only Dashboard tab to AdminSidebar"
```

---

### Task 5: Create creator dashboard page

**Files:**
- Create: `src/app/admin/(dashboard)/creator-dashboard/page.tsx`

The page follows the same pattern as `src/app/admin/(dashboard)/affiliate/page.tsx`: client component, `useConvexAuth` guard, `useQuery` for data, `StatCard` for metrics.

- [ ] **Step 15: Create `src/app/admin/(dashboard)/creator-dashboard/page.tsx`**

```ts
"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

function StatCard({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
}) {
    return (
        <div className="bg-surface2/50 border border-border rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm text-secondary font-medium">{label}</span>
                <div className={`p-2 rounded-xl ${color}`}>
                    <Icon size={16} />
                </div>
            </div>
            <p className="text-3xl font-bold text-primary">{value}</p>
        </div>
    );
}

export default function CreatorDashboardPage() {
    const { isAuthenticated } = useConvexAuth();
    const user = useCurrentUser();
    const stats = useQuery(api.posts.queries.getMyPostStats, isAuthenticated ? {} : "skip");
    const recentPosts = useQuery(api.posts.queries.getRecent, isAuthenticated ? { limit: 5 } : "skip");

    if (user === undefined || stats === undefined) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const greeting = user?.name ? `Hi, ${user.name}` : "Hi";

    return (
        <div className="max-w-4xl space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-1">{greeting}</h1>
                <p className="text-secondary">Hier ist eine Übersicht deiner Inhalte.</p>
            </div>

            {/* Stat cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Ready to Post"
                    value={stats?.ready_to_post ?? 0}
                    icon={CheckCircle2}
                    color="bg-emerald-500/10 text-emerald-400"
                />
                <StatCard
                    label="Scheduled"
                    value={stats?.scheduled ?? 0}
                    icon={Clock}
                    color="bg-blue-500/10 text-blue-400"
                />
                <StatCard
                    label="Posted"
                    value={stats?.posted ?? 0}
                    icon={Send}
                    color="bg-purple-500/10 text-purple-400"
                />
                <StatCard
                    label="Failed"
                    value={stats?.failed ?? 0}
                    icon={XCircle}
                    color="bg-red-500/10 text-red-400"
                />
            </section>

            {/* Recent posts */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Letzte Inhalte</h2>
                        <p className="text-secondary text-sm mt-0.5">Deine zuletzt erstellten Posts</p>
                    </div>
                    <Link
                        href="/admin/contents"
                        className="flex items-center gap-1.5 text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Alle anzeigen
                        <ArrowRight size={14} />
                    </Link>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden">
                    {recentPosts === undefined ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : recentPosts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-secondary">
                            <p className="text-sm">Noch keine Inhalte erstellt.</p>
                            <Link
                                href="/admin/post-content"
                                className="text-sm text-accent hover:underline"
                            >
                                Ersten Post erstellen
                            </Link>
                        </div>
                    ) : (
                        recentPosts.map((post, idx) => {
                            const PLATFORM_EMOJI: Record<string, string> = { tiktok: "🎵", instagram: "📸" };
                            const STATUS_LABEL: Record<string, string> = {
                                ready_to_post: "Ready",
                                scheduled: "Scheduled",
                                posted: "Posted",
                                failed: "Failed",
                            };
                            const STATUS_COLOR: Record<string, string> = {
                                ready_to_post: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                                scheduled: "text-blue-400 bg-blue-400/10 border-blue-400/20",
                                posted: "text-purple-400 bg-purple-400/10 border-purple-400/20",
                                failed: "text-red-400 bg-red-400/10 border-red-400/20",
                            };
                            const platformEmoji = post.account
                                ? PLATFORM_EMOJI[post.account.platform] ?? "🌐"
                                : "🌐";

                            return (
                                <div
                                    key={post._id}
                                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface2/80 ${
                                        idx !== recentPosts.length - 1 ? "border-b border-border/50" : ""
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-primary truncate">{post.title}</p>
                                        {post.account && (
                                            <p className="text-xs text-secondary mt-0.5">
                                                {platformEmoji} @{post.account.username}
                                            </p>
                                        )}
                                    </div>
                                    <span
                                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[post.status] ?? "text-secondary bg-surface border-border"}`}
                                    >
                                        {STATUS_LABEL[post.status] ?? post.status}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            {/* Coming soon footer */}
            <p className="text-xs text-secondary/50 text-center pb-4">
                Mehr Analytics folgen bald.
            </p>
        </div>
    );
}
```

- [ ] **Step 16: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in the new page file.

- [ ] **Step 17: Commit**

```bash
git add src/app/admin/\(dashboard\)/creator-dashboard/page.tsx
git commit -m "feat: add creator dashboard page with post stats"
```

---

## Manual Verification Checklist

After all tasks are complete, verify the following manually in the running dev server (`npm run dev`):

- [ ] **Creator login** → lands on `/admin/creator-dashboard`, sees stat cards and recent posts
- [ ] **Creator sidebar** shows: Dashboard, Media, AI-Lab, Post Content, Contents (no Analytics, Bugs, etc.)
- [ ] **Creator tries to navigate to `/admin`** → redirected to `/admin/creator-dashboard`
- [ ] **Admin login** → `/admin` analytics unchanged, sidebar unchanged
- [ ] **Admin sidebar** does NOT show creator Dashboard tab
- [ ] **Affiliate login** → still lands on `/admin/affiliate`, no change
- [ ] **Direct API call as creator** → `GET /api/analytics/overview` returns 403
- [ ] **Direct API call as admin** → `GET /api/analytics/overview` returns data as before
