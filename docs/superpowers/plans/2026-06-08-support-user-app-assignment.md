# Support User Type + App Assignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `support` user role, a join table for app assignments, admin UI to manage those assignments, and a placeholder support route with correct role-based routing.

**Architecture:** Convex schema gets a new `support_assignments` table and `"support"` is added to the `users.type` and `user_invites.role` unions. Two new Convex modules handle assign/unassign mutations and lookup queries. The existing `/admin/users` page gets a new "Support Users" section with an inline modal for app assignment. `RoleGuard` is updated to redirect support users to a new placeholder `/admin/support` page.

**Tech Stack:** Convex (schema, mutations, queries), Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide icons, Sonner toasts.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `convex/schema.ts` | Add `"support"` to unions, add `support_assignments` table |
| Modify | `convex/user_invites/mutations.ts` | Add `"support"` to `role` union in `create` |
| Modify | `convex/user_invites/actions.ts` | Add `"support"` to `role` union + email label |
| Modify | `convex/users/mutations.ts` | Add `"support"` to type unions in both mutations |
| Create | `convex/support_assignments/mutations.ts` | `assign` and `unassign` mutations |
| Create | `convex/support_assignments/queries.ts` | `getAppsForUser` and `getUsersForApp` queries |
| Modify | `src/components/admin/RoleGuard.tsx` | Handle support user routing |
| Create | `src/app/admin/(dashboard)/support/page.tsx` | Placeholder support page |
| Modify | `src/app/admin/(dashboard)/users/page.tsx` | Support Users section + Apps modal + invite dropdown |

---

## Task 1: Schema — Add `"support"` type and `support_assignments` table

**Files:**
- Modify: `convex/schema.ts:13` (users.type union)
- Modify: `convex/schema.ts:70` (user_invites.role union)
- Modify: `convex/schema.ts` (add new table after `user_invites`)

- [ ] **Step 1: Update `users.type` union**

In `convex/schema.ts` line 13, replace:
```ts
type: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate")),
```
with:
```ts
type: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
```

- [ ] **Step 2: Update `user_invites.role` union**

In `convex/schema.ts` line 70, replace:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate")),
```
with:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
```

- [ ] **Step 3: Add `support_assignments` table**

After the `user_invites` table definition (after its closing `),` on line 80), add:

```ts
support_assignments: defineTable({
    userId: v.id("users"),
    appId: v.id("apps"),
})
    .index("by_user", ["userId"])
    .index("by_app", ["appId"]),
```

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add support user type and support_assignments table to schema"
```

---

## Task 2: Update invite mutations and actions for `"support"` role

**Files:**
- Modify: `convex/user_invites/mutations.ts:6` (role union in `create`)
- Modify: `convex/user_invites/actions.ts:13` (role union in `createAndSend`)
- Modify: `convex/user_invites/actions.ts:51` (roleLabel for email)

- [ ] **Step 1: Update `create` mutation role union**

In `convex/user_invites/mutations.ts` line 6, replace:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate")),
```
with:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
```

- [ ] **Step 2: Update `createAndSend` action role union**

In `convex/user_invites/actions.ts` line 13, replace:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate")),
```
with:
```ts
role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
```

- [ ] **Step 3: Update `roleLabel` in email template**

In `convex/user_invites/actions.ts` line 51, replace:
```ts
const roleLabel = args.role === "admin" ? "Admin" : args.role === "affiliate" ? "Affiliate" : "Creator";
```
with:
```ts
const roleLabel = args.role === "admin" ? "Admin" : args.role === "affiliate" ? "Affiliate" : args.role === "support" ? "Support" : "Creator";
```

- [ ] **Step 4: Commit**

```bash
git add convex/user_invites/mutations.ts convex/user_invites/actions.ts
git commit -m "feat: add support role to invite mutations and actions"
```

---

## Task 3: Update user mutations for `"support"` type

**Files:**
- Modify: `convex/users/mutations.ts:10` (`createUser` type union)
- Modify: `convex/users/mutations.ts:21` (type variable declaration)

- [ ] **Step 1: Update `createUser` type union**

In `convex/users/mutations.ts` line 10, replace:
```ts
type: v.optional(v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"))),
```
with:
```ts
type: v.optional(v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support"))),
```

- [ ] **Step 2: Update the `type` variable declaration in `createUser`**

In `convex/users/mutations.ts` line 21, replace:
```ts
let type: "admin" | "creator" | "affiliate" = args.type ?? "creator";
```
with:
```ts
let type: "admin" | "creator" | "affiliate" | "support" = args.type ?? "creator";
```

- [ ] **Step 3: Commit**

```bash
git add convex/users/mutations.ts
git commit -m "feat: add support type to user creation mutations"
```

---

## Task 4: Create `convex/support_assignments/mutations.ts`

**Files:**
- Create: `convex/support_assignments/mutations.ts`

- [ ] **Step 1: Create the file**

```ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — assign an app to a support user (idempotent).
export const assign = mutation({
  args: {
    userId: v.id("users"),
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    // Idempotent: skip if already assigned
    const existing = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("appId"), args.appId))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("support_assignments", {
      userId: args.userId,
      appId: args.appId,
    });
  },
});

// Admin-only — remove an app assignment from a support user (idempotent).
export const unassign = mutation({
  args: {
    userId: v.id("users"),
    appId: v.id("apps"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("appId"), args.appId))
      .first();
    if (!existing) return; // already not assigned

    await ctx.db.delete(existing._id);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/support_assignments/mutations.ts
git commit -m "feat: add support_assignments assign/unassign mutations"
```

---

## Task 5: Create `convex/support_assignments/queries.ts`

**Files:**
- Create: `convex/support_assignments/queries.ts`

- [ ] **Step 1: Create the file**

```ts
import { query } from "../_generated/server";
import { v } from "convex/values";

// Returns all app documents assigned to a support user.
export const getAppsForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assignments = await ctx.db
      .query("support_assignments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const apps = await Promise.all(
      assignments.map((a) => ctx.db.get(a.appId))
    );
    return apps.filter(Boolean);
  },
});

// Returns all user documents assigned to a given app.
export const getUsersForApp = query({
  args: { appId: v.id("apps") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const assignments = await ctx.db
      .query("support_assignments")
      .withIndex("by_app", (q) => q.eq("appId", args.appId))
      .collect();

    const users = await Promise.all(
      assignments.map((a) => ctx.db.get(a.userId))
    );
    return users.filter(Boolean);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/support_assignments/queries.ts
git commit -m "feat: add support_assignments queries (getAppsForUser, getUsersForApp)"
```

---

## Task 6: Update `RoleGuard` for support users

**Files:**
- Modify: `src/components/admin/RoleGuard.tsx`

- [ ] **Step 1: Add support route helper and update redirect logic**

Replace the entire file content with:

```tsx
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

// Support users can only access the support section (admins can too)
function isSupportAllowedRoute(pathname: string): boolean {
    return pathname === "/admin/support" || pathname.startsWith("/admin/support/");
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

        if (user.type === "support" && !isSupportAllowedRoute(pathname)) {
            router.replace("/admin/support");
        }
    }, [user, pathname, router]);

    // Show nothing while redirecting to avoid flash
    if (user?.type === "creator" && isAdminOnlyRoute(pathname)) return null;
    if (user?.type === "affiliate" && !isAffiliateAllowedRoute(pathname)) return null;
    if (user?.type === "support" && !isSupportAllowedRoute(pathname)) return null;

    return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/RoleGuard.tsx
git commit -m "feat: add support user routing to RoleGuard"
```

---

## Task 7: Create placeholder support page

**Files:**
- Create: `src/app/admin/(dashboard)/support/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
export default function SupportPage() {
    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <h1 className="text-3xl font-bold mb-1">Support</h1>
                <p className="text-secondary">Coming soon.</p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/(dashboard)/support/page.tsx
git commit -m "feat: add placeholder support page at /admin/support"
```

---

## Task 8: Update `/admin/users` page — invite dropdown + Support Users section

**Files:**
- Modify: `src/app/admin/(dashboard)/users/page.tsx`

This task has multiple steps as the page is substantial. Make changes incrementally.

- [ ] **Step 1: Add `SupportAppsModal` component and update imports**

At the top of the file, after the existing `AffiliateEditModal` component (after line 151), add the following imports and new component. First, extend the existing import from `convex/react` to include the new queries and mutations. Replace line 4:

```tsx
import { usePaginatedQuery, useQuery, useMutation, useAction } from "convex/react";
```
(no change needed here — `useQuery` and `useMutation` are already imported)

- [ ] **Step 2: Add `SupportAppsModal` component**

After the closing brace of `AffiliateEditModal` (after line 151, before `export default function UsersPage()`), insert this new component:

```tsx
interface SupportAppsModalProps {
    userId: Id<"users">;
    onClose: () => void;
}

function SupportAppsModal({ userId, onClose }: SupportAppsModalProps) {
    const allApps = useQuery(api.apps.queries.getAll);
    const assignedApps = useQuery(api.support_assignments.queries.getAppsForUser, { userId });
    const assignMutation = useMutation(api.support_assignments.mutations.assign);
    const unassignMutation = useMutation(api.support_assignments.mutations.unassign);

    const [saving, setSaving] = useState(false);
    // Local selection state: null means "not yet initialised from server"
    const [selected, setSelected] = useState<Set<string> | null>(null);

    // Initialise once assigned apps are loaded
    if (assignedApps !== undefined && selected === null) {
        setSelected(new Set(assignedApps.map((a) => a!._id)));
    }

    const toggle = (appId: string) => {
        setSelected((prev) => {
            if (!prev) return prev;
            const next = new Set(prev);
            if (next.has(appId)) next.delete(appId);
            else next.add(appId);
            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allApps || !assignedApps || !selected) return;
        setSaving(true);
        try {
            const previousIds = new Set(assignedApps.map((a) => a!._id));
            const toAssign = [...selected].filter((id) => !previousIds.has(id as Id<"apps">));
            const toUnassign = [...previousIds].filter((id) => !selected.has(id));

            await Promise.all([
                ...toAssign.map((appId) => assignMutation({ userId, appId: appId as Id<"apps"> })),
                ...toUnassign.map((appId) => unassignMutation({ userId, appId: appId as Id<"apps"> })),
            ]);
            toast.success("App-Zuweisungen gespeichert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    const isLoading = allApps === undefined || assignedApps === undefined || selected === null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Apps verwalten</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-secondary text-sm py-4">
                        <Loader2 size={14} className="animate-spin" /> Wird geladen…
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4">
                        {allApps.length === 0 ? (
                            <p className="text-secondary text-sm">Keine Apps vorhanden.</p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {allApps.map((app) => (
                                    <label
                                        key={app._id}
                                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface2/80 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected?.has(app._id) ?? false}
                                            onChange={() => toggle(app._id)}
                                            disabled={saving}
                                            className="accent-accent w-4 h-4"
                                        />
                                        <span className="text-sm text-primary">{app.name}</span>
                                        <span className="text-xs text-secondary font-mono ml-auto">{app.slug}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 py-3 border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                disabled={saving || allApps.length === 0}
                                className="flex-1 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Wird gespeichert…" : "Speichern"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Update state types and invite role type in `UsersPage`**

In `UsersPage`, find line 167:
```tsx
const [inviteRole, setInviteRole] = useState<"admin" | "creator" | "affiliate">("creator");
```
Replace with:
```tsx
const [inviteRole, setInviteRole] = useState<"admin" | "creator" | "affiliate" | "support">("creator");
```

Add a new state variable for the support modal directly after `editingUserId` state (line 173):
```tsx
const [managingAppsForUserId, setManagingAppsForUserId] = useState<Id<"users"> | null>(null);
```

- [ ] **Step 4: Update `handleInvite` to pass `inviteRole` correctly**

The `createAndSend` action call on line 179 already passes `role: inviteRole` — no change needed there. However the `onChange` handler for the role select (line 241) casts to `"admin" | "creator" | "affiliate"`. Update that cast:

Replace:
```tsx
setInviteRole(e.target.value as "admin" | "creator" | "affiliate");
```
with:
```tsx
setInviteRole(e.target.value as "admin" | "creator" | "affiliate" | "support");
```

- [ ] **Step 5: Add "Support" option to invite role `<select>`**

Find the `<select>` for role in the invite form (around line 248). After `<option value="affiliate">Affiliate</option>`, add:
```tsx
<option value="support">Support</option>
```

- [ ] **Step 6: Add "Support Users" section to the page**

After the closing `</section>` of the "Aktive Benutzer" section (after line 436) and before the `{editingUserId && ...}` modal render, add the new section:

```tsx
{/* Support Users */}
<section>
    <h2 className="text-xl font-semibold mb-4">Support Users</h2>
    {(() => {
        const supportUsers = users.filter((u) => u.type === "support");
        return supportUsers.length === 0 ? (
            <p className="text-secondary text-sm">Keine Support-User vorhanden.</p>
        ) : (
            <div className="border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-surface2/30">
                            <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                            <th className="text-left px-4 py-3 text-secondary font-medium">Zugewiesene Apps</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody>
                        {supportUsers.map((u) => (
                            <SupportUserRow
                                key={u._id}
                                userId={u._id}
                                email={u.email ?? "—"}
                                onManage={() => setManagingAppsForUserId(u._id)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        );
    })()}
</section>
```

- [ ] **Step 7: Add `SupportUserRow` component**

This component fetches assigned apps per-row. Add it just before `SupportAppsModal` (i.e., after `AffiliateEditModal`):

```tsx
interface SupportUserRowProps {
    userId: Id<"users">;
    email: string;
    onManage: () => void;
}

function SupportUserRow({ userId, email, onManage }: SupportUserRowProps) {
    const assignedApps = useQuery(api.support_assignments.queries.getAppsForUser, { userId });

    return (
        <tr className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
            <td className="px-4 py-3 text-primary">{email}</td>
            <td className="px-4 py-3">
                {assignedApps === undefined ? (
                    <Loader2 size={12} className="animate-spin text-secondary" />
                ) : assignedApps.length === 0 ? (
                    <span className="text-secondary text-xs">Keine Apps</span>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {assignedApps.map((app) => app && (
                            <span
                                key={app._id}
                                className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400"
                            >
                                {app.name}
                            </span>
                        ))}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    onClick={onManage}
                    className="text-secondary hover:text-accent transition-colors p-1"
                    title="Apps verwalten"
                >
                    <Pencil size={16} />
                </button>
            </td>
        </tr>
    );
}
```

- [ ] **Step 8: Render `SupportAppsModal` and update "support" badge in Active Users table**

After the existing `{editingUserId && <AffiliateEditModal ... />}` line, add:
```tsx
{managingAppsForUserId && (
    <SupportAppsModal
        userId={managingAppsForUserId}
        onClose={() => setManagingAppsForUserId(null)}
    />
)}
```

Also update the role badge in the Active Users table to handle support. Find this block (around line 394):
```tsx
<span className={`text-xs font-medium px-2 py-1 rounded-full ${
    u.type === "admin"
        ? "bg-accent/20 text-accent"
        : u.type === "affiliate"
        ? "bg-purple-500/20 text-purple-400"
        : "bg-blue-500/20 text-blue-400"
}`}>
    {u.type === "admin" ? "Admin" : u.type === "affiliate" ? "Affiliate" : "Creator"}
</span>
```
Replace with:
```tsx
<span className={`text-xs font-medium px-2 py-1 rounded-full ${
    u.type === "admin"
        ? "bg-accent/20 text-accent"
        : u.type === "affiliate"
        ? "bg-purple-500/20 text-purple-400"
        : u.type === "support"
        ? "bg-green-500/20 text-green-400"
        : "bg-blue-500/20 text-blue-400"
}`}>
    {u.type === "admin" ? "Admin" : u.type === "affiliate" ? "Affiliate" : u.type === "support" ? "Support" : "Creator"}
</span>
```

Also update the invite badge in the Open Invites table (around line 329) similarly — find:
```tsx
invite.role === "admin"
    ? "bg-accent/20 text-accent"
    : invite.role === "affiliate"
    ? "bg-purple-500/20 text-purple-400"
    : "bg-blue-500/20 text-blue-400"
```
Replace with:
```tsx
invite.role === "admin"
    ? "bg-accent/20 text-accent"
    : invite.role === "affiliate"
    ? "bg-purple-500/20 text-purple-400"
    : invite.role === "support"
    ? "bg-green-500/20 text-green-400"
    : "bg-blue-500/20 text-blue-400"
```
And update the role label text inline:
```tsx
{invite.role === "admin" ? "Admin" : invite.role === "affiliate" ? "Affiliate" : invite.role === "support" ? "Support" : "Creator"}
```

Also update the type annotation for the `invite` object in the `openInvites.map(...)` call (around line 317). Find:
```tsx
role: "admin" | "creator" | "affiliate";
```
Replace with:
```tsx
role: "admin" | "creator" | "affiliate" | "support";
```

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/(dashboard)/users/page.tsx
git commit -m "feat: add Support Users section and SupportAppsModal to User & Roles page"
```

---

## Task 9: Verify TypeScript compiles cleanly

- [ ] **Step 1: Run the TypeScript compiler**

```bash
cd /Users/leonardogranetto/Projects/northbyte_studio && npx tsc --noEmit
```

Expected: no errors. If there are type errors, fix them before proceeding.

Common issues to watch for:
- `Id<"apps">` vs `string` mismatches in the modal
- Missing import for `api.support_assignments` (Convex auto-generates this after schema push)
- The `allApps` / `assignedApps` queries returning `null` items (the `filter(Boolean)` in queries.ts handles this, but the `app!._id` non-null assertion in the modal might need adjustment)

- [ ] **Step 2: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: resolve TypeScript errors in support user implementation"
```

---

## Completion Checklist

- [ ] `convex/schema.ts` has `"support"` in both unions and `support_assignments` table
- [ ] `user_invites/mutations.ts` and `actions.ts` accept `"support"` role
- [ ] `users/mutations.ts` accepts `"support"` type
- [ ] `support_assignments/mutations.ts` created with `assign` and `unassign`
- [ ] `support_assignments/queries.ts` created with `getAppsForUser` and `getUsersForApp`
- [ ] `RoleGuard.tsx` redirects support users to `/admin/support`
- [ ] `/admin/support/page.tsx` placeholder created
- [ ] `/admin/users` page shows "Support" in invite dropdown, support badge, Support Users section with modal
- [ ] `tsc --noEmit` passes
