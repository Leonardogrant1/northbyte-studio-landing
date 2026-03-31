# Creator Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a creator role, invite-based sign-up system, role-based navigation, and three new creator pages to the admin dashboard.

**Architecture:** Role is stored as `type` in the Convex `users` table. Admins create invites in a new `user_invites` table. Sign-up checks for an open invite before proceeding, then calls a Convex mutation after verification to create the user with the correct role. The dashboard uses Clerk auth server-side for the gate check, and a client-side `RoleGuard` component for route-level role enforcement. The `AdminSidebar` reads the current user's role from Convex and conditionally renders nav items.

**Tech Stack:** Next.js App Router, Convex (real-time backend), Clerk (auth), TypeScript, Tailwind CSS, Lucide React, `convex/react` (`useQuery`, `useMutation`)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `convex/schema.ts` | Add `type` to `users`, add `user_invites` table |
| Create | `convex/user_invites/queries.ts` | `getOpenInviteByEmail` (public), `getAll` (admin-only) |
| Create | `convex/user_invites/mutations.ts` | `create`, `remove` |
| Modify | `convex/users/mutations.ts` | Add `type` to `createUser`, add `createUserFromInvite` |
| Modify | `convex/users/queries.ts` | Add `getAllUsers` query |
| Modify | `convex/users/webhooks.ts` | Look up invite to set role on webhook-created users |
| Modify | `src/lib/auth.ts` | Remove `isAdmin()` + domain check, keep `getCurrentUser` |
| Modify | `src/lib/auth-utils.ts` | Remove `isNorthByteEmail` |
| Modify | `src/app/admin/login/page.tsx` | Remove domain restriction |
| Modify | `src/app/admin/signup/page.tsx` | Add invite check + `createUserFromInvite` call |
| Modify | `src/app/admin/(dashboard)/layout.tsx` | Replace `isAdmin()` with Clerk `auth()` check; mount `RoleGuard` |
| Create | `src/components/admin/RoleGuard.tsx` | Client component; redirects creators away from admin-only routes |
| Modify | `src/components/admin/AdminSidebar.tsx` | Role-based nav tab filtering |
| Create | `src/app/admin/(dashboard)/media/page.tsx` | Dummy Media page |
| Create | `src/app/admin/(dashboard)/ai-lab/page.tsx` | Dummy AI-Lab page |
| Create | `src/app/admin/(dashboard)/post-content/page.tsx` | Dummy Post Content page |
| Create | `src/app/admin/(dashboard)/users/page.tsx` | User & Roles admin page |

---

## Task 1: Update Convex Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `type` field to `users` and add `user_invites` table**

Replace the entire `convex/schema.ts` with:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    users: defineTable({
        clerkId: v.string(),
        email: v.optional(v.string()),
        type: v.union(v.literal("admin"), v.literal("creator")),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_clerk", ["clerkId"]),

    user_invites: defineTable({
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("creator")),
        invitedBy: v.id("users"),
        createdAt: v.number(),
        usedAt: v.optional(v.number()),
    }).index("by_email", ["email"]),

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

    bugs: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    features: defineTable({
        appId: v.id("apps"),
        title: v.string(),
        description: v.string(),
        upvotes: v.number(),
        status: v.string(),
    }).index("by_app", ["appId"]),

    bugSubscribers: defineTable({
        email: v.string(),
        bugId: v.id("bugs"),
    })
        .index("by_bug", ["bugId"])
        .index("by_email_bug", ["email", "bugId"]),

    featureSubscribers: defineTable({
        email: v.string(),
        featureId: v.id("features"),
    })
        .index("by_feature", ["featureId"])
        .index("by_email_feature", ["email", "featureId"]),

    vendors: defineTable({
        name: v.string(),
    }).index("by_name", ["name"]),

    categories: defineTable({
        name: v.string(),
    }).index("by_name", ["name"]),

    expenses: defineTable({
        description: v.string(),
        vendor_invoice_id: v.optional(v.string()),
        vendor_receipt_id: v.optional(v.string()),
        vendor_id: v.id("vendors"),
        category_id: v.id("categories"),
        original_amount: v.number(),
        original_currency: v.string(),
        amount_usd: v.number(),
        tax_amount: v.optional(v.number()),
        date: v.string(),
        urls: v.optional(v.array(v.string())),
    })
        .index("by_vendor", ["vendor_id"])
        .index("by_category", ["category_id"])
        .index("by_vendor_invoice", ["vendor_id", "vendor_invoice_id"])
        .index("by_vendor_receipt", ["vendor_id", "vendor_receipt_id"]),
});
```

- [ ] **Step 2: Backfill existing users**

Convex enforces the new schema on writes but existing documents without `type` will cause TypeScript errors. Go to the Convex Dashboard → Data → `users` table and manually set `type: "admin"` on any existing records before proceeding. (There are typically very few records in dev.)

Alternatively, run `npx convex dev` and use the Convex dashboard Functions tab to run a one-off mutation that patches all existing users to `type: "admin"`.

- [ ] **Step 3: Verify Convex picks up schema changes**

Convex Dev should be running (`npx convex dev`). Check the terminal for schema push confirmation. If not running, start it now — it must be running for `_generated` types to update throughout this plan.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add type field to users and user_invites table"
```

> **Note:** Run all commands from the project root: `/Users/leonardogranetto/Projects/northbyte_studio`.

---

## Task 2: Create `convex/user_invites/` Backend

**Files:**
- Create: `convex/user_invites/queries.ts`
- Create: `convex/user_invites/mutations.ts`

- [ ] **Step 1: Create `convex/user_invites/queries.ts`**

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

// Public query — no auth required. Used by signup page before user has an account.
// Returns the most recent open invite for the given email, or null.
export const getOpenInviteByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();

    const open = invites.filter((i) => i.usedAt === undefined);
    if (open.length === 0) return null;

    // Return the most recently created open invite
    return open.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});

// Admin-only query — returns all invites for the User & Roles page.
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("user_invites").order("desc").collect();
  },
});
```

- [ ] **Step 2: Create `convex/user_invites/mutations.ts`**

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Admin-only — create a new invite.
export const create = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("creator")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    // Check if an open invite for this email already exists
    const existing = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();
    const alreadyOpen = existing.some((i) => i.usedAt === undefined);
    if (alreadyOpen) throw new Error("Es gibt bereits eine offene Einladung für diese E-Mail.");

    return await ctx.db.insert("user_invites", {
      email: args.email.toLowerCase(),
      role: args.role,
      invitedBy: caller._id,
      createdAt: Date.now(),
    });
  },
});

// Admin-only — revoke (delete) an open invite.
export const remove = mutation({
  args: { inviteId: v.id("user_invites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Einladung nicht gefunden.");
    if (invite.usedAt !== undefined) throw new Error("Eingelöste Einladungen können nicht widerrufen werden.");

    await ctx.db.delete(args.inviteId);
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add convex/user_invites/queries.ts convex/user_invites/mutations.ts
git commit -m "feat: add user_invites Convex backend"
```

---

## Task 3: Update Users Mutations + Webhook

**Files:**
- Modify: `convex/users/mutations.ts`
- Modify: `convex/users/webhooks.ts`

- [ ] **Step 1: Rewrite `convex/users/mutations.ts`**

```typescript
import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";

// Called from Clerk webhook — creates user with role.
// Falls back to "admin" for @northbyte.studio emails (existing accounts migration).
export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    type: v.optional(v.union(v.literal("admin"), v.literal("creator"))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existing) return existing._id;

    // Determine role: explicit type > northbyte fallback > default creator
    let type: "admin" | "creator" = args.type ?? "creator";
    if (!args.type && args.email?.endsWith("@northbyte.studio")) {
      type = "admin";
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      type,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Called from signup page after Clerk verification completes.
// Creates (or updates) the user with the role from a valid invite.
// Marks the invite as used.
export const createUserFromInvite = mutation({
  args: { inviteId: v.id("user_invites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Einladung nicht gefunden.");
    if (invite.usedAt !== undefined) throw new Error("Diese Einladung wurde bereits verwendet.");

    const now = Date.now();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existing) {
      // Webhook may have already created the user — update their type
      await ctx.db.patch(existing._id, { type: invite.role, updatedAt: now });
      await ctx.db.patch(args.inviteId, { usedAt: now });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email,
      type: invite.role,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(args.inviteId, { usedAt: now });
    return userId;
  },
});
```

- [ ] **Step 2: Update `convex/users/webhooks.ts` to look up invite**

```typescript
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const clerkWebhook = httpAction(async (ctx, request) => {
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing svix headers");
    return new Response("Missing svix headers", { status: 400 });
  }

  try {
    const body = await request.json();
    const eventType = body.type;

    console.log("Clerk webhook received:", eventType);

    if (eventType === "user.created") {
      const { id: clerkId, email_addresses } = body.data;
      const email: string | undefined = email_addresses?.[0]?.email_address;

      // Look up open invite to determine role
      let type: "admin" | "creator" | undefined;
      if (email) {
        const invites = await ctx.runQuery(internal.user_invites.queries.getOpenInviteByEmailInternal, { email });
        if (invites) {
          type = invites.role;
        }
      }

      await ctx.runMutation(internal.users.mutations.createUser, {
        clerkId,
        email,
        type,
      });

      console.log("User created:", clerkId, "type:", type ?? "fallback");
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    );
  }
});
```

- [ ] **Step 3: Add internal invite query for webhook use**

The webhook uses `internal.user_invites.queries.getOpenInviteByEmailInternal` — add this to `convex/user_invites/queries.ts`:

```typescript
import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// ... (keep existing getOpenInviteByEmail and getAll)

// Internal version — used by the webhook (no auth check needed, called server-side).
export const getOpenInviteByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("user_invites")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .collect();

    const open = invites.filter((i) => i.usedAt === undefined);
    if (open.length === 0) return null;
    return open.sort((a, b) => b.createdAt - a.createdAt)[0];
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add convex/users/mutations.ts convex/users/webhooks.ts convex/user_invites/queries.ts
git commit -m "feat: update user mutations with role support and invite redemption"
```

---

## Task 4: Add `getAllUsers` Query

**Files:**
- Modify: `convex/users/queries.ts`

- [ ] **Step 1: Add `getAllUsers` to `convex/users/queries.ts`**

```typescript
import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) return null;
    return user;
  },
});

// Admin-only — returns all registered users for the User & Roles page.
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") throw new Error("Unauthorized");

    return await ctx.db.query("users").order("desc").collect();
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return user;
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/users/queries.ts
git commit -m "feat: add getAllUsers query for admin user management"
```

---

## Task 5: Remove Domain Restriction from Auth + Login

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth-utils.ts`
- Modify: `src/app/admin/login/page.tsx`

- [ ] **Step 1: Rewrite `src/lib/auth.ts`**

Remove `isAdmin()` and `isNorthByteEmail` re-export. Keep only `getCurrentUser` (used server-side for auth check in layout).

```typescript
import { auth } from "@clerk/nextjs/server";

/**
 * Returns the Clerk userId if authenticated, null otherwise.
 * Used server-side to gate the dashboard layout.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
    const { userId } = await auth();
    return userId ?? null;
}
```

- [ ] **Step 2: Rewrite `src/lib/auth-utils.ts`**

The file is no longer needed, but to avoid import errors during transition, empty it safely:

```typescript
// Domain restriction removed — all users are now invite-based.
// This file is kept for backwards compatibility during transition.
```

- [ ] **Step 3: Update `src/app/admin/login/page.tsx`**

Remove the `isNorthByteEmail` import and domain check block. Find and remove these two blocks:

Remove the import line:
```typescript
import { isNorthByteEmail } from "@/lib/auth-utils";
```

Remove the domain check inside `handleSubmit` (before `setLoading(true)`):
```typescript
        if (!needs2FA && !isNorthByteEmail(email)) {
            setError("Nur @northbyte.studio E-Mail-Adressen sind erlaubt.");
            return;
        }
```

Also update the placeholder and helper text in the email input — change:
```typescript
                                    placeholder="admin@northbyte.studio"
                                />
                                <p className="text-xs text-secondary/70">
                                    Nur @northbyte.studio E-Mails
                                </p>
```
to:
```typescript
                                    placeholder="deine@email.com"
                                />
```

(Remove the `<p>` tag entirely.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts src/lib/auth-utils.ts src/app/admin/login/page.tsx
git commit -m "feat: remove northbyte.studio domain restriction from auth and login"
```

---

## Task 6: Update Signup Page with Invite Check

**Files:**
- Modify: `src/app/admin/signup/page.tsx`

The signup page needs to:
1. Use `useQuery` to proactively check for an open invite as the user types their email
2. Block form submission if no valid invite found
3. After successful verification + `signUp.finalize()`, call `createUserFromInvite` mutation

- [ ] **Step 1: Rewrite `src/app/admin/signup/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function AdminSignUpPage() {
    const { signUp, fetchStatus } = useSignUp();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(false);

    // Check if an open invite exists for the typed email (runs reactively)
    const invite = useQuery(
        api.user_invites.queries.getOpenInviteByEmail,
        email.length > 3 ? { email } : "skip"
    );
    const createUserFromInvite = useMutation(api.users.mutations.createUserFromInvite);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fetchStatus === "fetching") return;
        setError("");

        // invite === undefined means query is still loading; null means no invite found
        if (invite === null) {
            setError("Du wurdest nicht eingeladen. Bitte wende dich an einen Admin.");
            return;
        }
        if (invite === undefined) {
            setError("Einladung wird geprüft…");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwörter stimmen nicht überein.");
            return;
        }
        if (password.length < 8) {
            setError("Passwort muss mindestens 8 Zeichen lang sein.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await signUp.password({
                emailAddress: email,
                password,
                firstName,
                lastName,
            });

            if (error) {
                setError(error.message);
                return;
            }

            const { error: sendError } = await signUp.verifications.sendEmailCode();
            if (sendError) {
                setError(sendError.message);
                return;
            }

            setPendingVerification(true);
        } catch {
            setError("Registrierung fehlgeschlagen.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fetchStatus === "fetching") return;
        setError("");
        setLoading(true);

        try {
            const { error } = await signUp.verifications.verifyEmailCode({
                code: verificationCode,
            });

            if (error) {
                setError(error.message);
                return;
            }

            if (signUp.status === "complete") {
                await signUp.finalize();

                // invite is guaranteed non-null here (checked at submit time)
                if (invite?._id) {
                    await createUserFromInvite({ inviteId: invite._id });
                }

                router.push("/admin");
            }
        } catch {
            setError("Verifizierung fehlgeschlagen.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Registrierung</h1>
                    <p className="text-secondary">NorthByte Studio Dashboard</p>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
                    {!pendingVerification ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="firstName" className="text-sm font-medium text-secondary">
                                        Vorname
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Max"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="lastName" className="text-sm font-medium text-secondary">
                                        Nachname
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Mustermann"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium text-secondary">
                                    E-Mail
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="deine@email.com"
                                />
                                {email.length > 3 && invite === null && (
                                    <p className="text-xs text-red-400">Keine Einladung für diese E-Mail gefunden.</p>
                                )}
                                {email.length > 3 && invite && (
                                    <p className="text-xs text-green-400">Einladung gefunden — Rolle: {invite.role}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-secondary">
                                    Passwort
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                                <p className="text-xs text-secondary/70">Mindestens 8 Zeichen</p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="text-sm font-medium text-secondary">
                                    Passwort bestätigen
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || fetchStatus === "fetching"}
                                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Wird registriert..." : "Registrieren"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerification} className="space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="text-center mb-6">
                                <p className="text-secondary">
                                    Wir haben einen Verifizierungscode an <strong className="text-primary">{email}</strong> gesendet.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="code" className="text-sm font-medium text-secondary">
                                    Verifizierungscode
                                </label>
                                <input
                                    type="text"
                                    id="code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    required
                                    disabled={loading}
                                    autoFocus
                                    maxLength={6}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="000000"
                                />
                                <p className="text-xs text-secondary/70">
                                    Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || fetchStatus === "fetching"}
                                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Wird verifiziert..." : "Verifizieren"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setPendingVerification(false);
                                    setVerificationCode("");
                                    setError("");
                                }}
                                className="w-full text-sm text-accent hover:underline"
                            >
                                ← Zurück zur Registrierung
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center mt-6 space-y-2">
                    <a
                        href="/admin/login"
                        className="block text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Bereits registriert? Zum Login →
                    </a>
                    <a
                        href="/"
                        className="block text-sm text-secondary hover:text-accent transition-colors"
                    >
                        ← Zurück zur Hauptseite
                    </a>
                </div>
            </motion.div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/signup/page.tsx
git commit -m "feat: add invite check to signup flow"
```

---

## Task 7: Update Dashboard Layout

**Files:**
- Modify: `src/app/admin/(dashboard)/layout.tsx`

- [ ] **Step 1: Update `src/app/admin/(dashboard)/layout.tsx`**

Replace `isAdmin()` with `getAuthenticatedUserId()` and add `RoleGuard`:

```typescript
import { redirect } from "next/navigation";
import { getAuthenticatedUserId } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { RoleGuard } from "@/components/admin/RoleGuard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
        redirect("/admin/login");
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="px-8 pt-6 pb-4 border-b border-border">
                <AdminHeader />
            </div>
            <div className="flex flex-1">
                <AdminSidebar />
                <main className="flex-1 p-8 overflow-auto">
                    <RoleGuard>
                        {children}
                    </RoleGuard>
                </main>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/(dashboard)/layout.tsx
git commit -m "feat: replace isAdmin with Clerk auth check in dashboard layout"
```

---

## Task 8: Create `RoleGuard` Component

**Files:**
- Create: `src/components/admin/RoleGuard.tsx`

- [ ] **Step 1: Create `src/components/admin/RoleGuard.tsx`**

```typescript
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// Routes that only admins can access
const ADMIN_ONLY_ROUTES = ["/admin", "/admin/bugs", "/admin/features", "/admin/apps", "/admin/users"];

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

        if (user.type === "creator" && ADMIN_ONLY_ROUTES.includes(pathname)) {
            router.replace("/admin/media");
        }
    }, [user, pathname, router]);

    // Show nothing while redirecting to avoid flash
    if (user?.type === "creator" && ADMIN_ONLY_ROUTES.includes(pathname)) {
        return null;
    }

    return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/RoleGuard.tsx
git commit -m "feat: add RoleGuard client component for creator route protection"
```

---

## Task 9: Update `AdminSidebar` with Role-Based Navigation

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Rewrite `src/components/admin/AdminSidebar.tsx`**

```typescript
"use client";

import Link from "next/link";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { BarChart2, Bug, Lightbulb, AppWindow, Image, FlaskConical, FileEdit, Users } from "lucide-react";
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

    const allTabs = [
        {
            label: "Analytics",
            icon: BarChart2,
            href: `/admin${appQuery}`,
            isActive: pathname === "/admin",
            adminOnly: true,
        },
        {
            label: "Bugs",
            icon: Bug,
            href: `/admin/bugs${appQuery}`,
            isActive: pathname === "/admin/bugs",
            adminOnly: true,
        },
        {
            label: "Features",
            icon: Lightbulb,
            href: `/admin/features${appQuery}`,
            isActive: pathname === "/admin/features",
            adminOnly: true,
        },
        {
            label: "Apps",
            icon: AppWindow,
            href: `/admin/apps${appQuery}`,
            isActive: pathname === "/admin/apps",
            adminOnly: true,
        },
        {
            label: "Media",
            icon: Image,
            href: "/admin/media",
            isActive: pathname === "/admin/media",
            adminOnly: false,
        },
        {
            label: "AI-Lab",
            icon: FlaskConical,
            href: "/admin/ai-lab",
            isActive: pathname === "/admin/ai-lab",
            adminOnly: false,
        },
        {
            label: "Post Content",
            icon: FileEdit,
            href: "/admin/post-content",
            isActive: pathname === "/admin/post-content",
            adminOnly: false,
        },
        {
            label: "User & Roles",
            icon: Users,
            href: "/admin/users",
            isActive: pathname === "/admin/users",
            adminOnly: true,
        },
    ];

    const tabs = allTabs.filter((tab) => !tab.adminOnly || isAdmin);

    return (
        <aside className="w-56 shrink-0 border-r border-border p-4">
            <nav className="space-y-1">
                {tabs.map(({ label, icon: Icon, href, isActive }) => (
                    <Link
                        key={label}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/AdminSidebar.tsx
git commit -m "feat: add role-based navigation to AdminSidebar"
```

---

## Task 10: Create Dummy Pages

**Files:**
- Create: `src/app/admin/(dashboard)/media/page.tsx`
- Create: `src/app/admin/(dashboard)/ai-lab/page.tsx`
- Create: `src/app/admin/(dashboard)/post-content/page.tsx`

- [ ] **Step 1: Create `src/app/admin/(dashboard)/media/page.tsx`**

```typescript
export default function MediaPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="text-6xl mb-6">🖼️</div>
            <h1 className="text-3xl font-bold mb-2">Media</h1>
            <p className="text-secondary">Diese Seite ist in Arbeit.</p>
        </div>
    );
}
```

- [ ] **Step 2: Create `src/app/admin/(dashboard)/ai-lab/page.tsx`**

```typescript
export default function AILabPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="text-6xl mb-6">🧪</div>
            <h1 className="text-3xl font-bold mb-2">AI-Lab</h1>
            <p className="text-secondary">Diese Seite ist in Arbeit.</p>
        </div>
    );
}
```

- [ ] **Step 3: Create `src/app/admin/(dashboard)/post-content/page.tsx`**

```typescript
export default function PostContentPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
            <div className="text-6xl mb-6">✍️</div>
            <h1 className="text-3xl font-bold mb-2">Post Content</h1>
            <p className="text-secondary">Diese Seite ist in Arbeit.</p>
        </div>
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/(dashboard)/media/page.tsx src/app/admin/(dashboard)/ai-lab/page.tsx src/app/admin/(dashboard)/post-content/page.tsx
git commit -m "feat: add dummy pages for Media, AI-Lab, and Post Content"
```

---

## Task 11: Create User & Roles Admin Page

**Files:**
- Create: `src/app/admin/(dashboard)/users/page.tsx`

- [ ] **Step 1: Create `src/app/admin/(dashboard)/users/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function UsersPage() {
    const users = useQuery(api.users.queries.getAllUsers);
    const invites = useQuery(api.user_invites.queries.getAll);
    const createInvite = useMutation(api.user_invites.mutations.create);
    const removeInvite = useMutation(api.user_invites.mutations.remove);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"admin" | "creator">("creator");
    const [loading, setLoading] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createInvite({ email: inviteEmail, role: inviteRole });
            setInviteEmail("");
            toast.success(`Einladung für ${inviteEmail} erstellt.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Einladen.");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (inviteId: Id<"user_invites">) => {
        try {
            await removeInvite({ inviteId });
            toast.success("Einladung widerrufen.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Widerrufen.");
        }
    };

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
        <div className="max-w-4xl space-y-10">
            <div>
                <h1 className="text-3xl font-bold mb-1">User & Roles</h1>
                <p className="text-secondary">Benutzer einladen und Rollen verwalten.</p>
            </div>

            {/* Invite Form */}
            <section className="bg-surface2/50 border border-border rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <UserPlus size={20} />
                    Benutzer einladen
                </h2>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        placeholder="email@beispiel.com"
                        disabled={loading}
                        className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "admin" | "creator")}
                        disabled={loading}
                        className="bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                    >
                        <option value="creator">Creator</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Wird eingeladen…" : "Einladen"}
                    </button>
                </form>
            </section>

            {/* Open Invites */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Einladungen</h2>
                {!invites || invites.length === 0 ? (
                    <p className="text-secondary text-sm">Keine Einladungen vorhanden.</p>
                ) : (
                    <div className="border border-border rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface2/30">
                                    <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Rolle</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Eingeladen am</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {invites.map((invite) => (
                                    <tr key={invite._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                        <td className="px-4 py-3 text-primary">{invite.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                invite.role === "admin"
                                                    ? "bg-accent/20 text-accent"
                                                    : "bg-blue-500/20 text-blue-400"
                                            }`}>
                                                {invite.role === "admin" ? "Admin" : "Creator"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-secondary">{formatDate(invite.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                invite.usedAt
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-yellow-500/20 text-yellow-400"
                                            }`}>
                                                {invite.usedAt ? "Eingelöst" : "Offen"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!invite.usedAt && (
                                                <button
                                                    onClick={() => handleRevoke(invite._id)}
                                                    className="text-secondary hover:text-red-400 transition-colors p-1"
                                                    title="Einladung widerrufen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Active Users */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Aktive Benutzer</h2>
                {!users || users.length === 0 ? (
                    <p className="text-secondary text-sm">Keine Benutzer vorhanden.</p>
                ) : (
                    <div className="border border-border rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface2/30">
                                    <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Rolle</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Registriert am</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                        <td className="px-4 py-3 text-primary">{u.email ?? "—"}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                u.type === "admin"
                                                    ? "bg-accent/20 text-accent"
                                                    : "bg-blue-500/20 text-blue-400"
                                            }`}>
                                                {u.type === "admin" ? "Admin" : "Creator"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-secondary">{formatDate(u.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/(dashboard)/users/page.tsx
git commit -m "feat: add User & Roles admin page"
```

---

## Task 12: Verify Build

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. If there are errors about the `users` table missing `type` on existing data — these are runtime data issues, not TypeScript errors. The schema uses `v.union` which Convex enforces at runtime for new inserts.

- [ ] **Step 2: Run dev build check**

```bash
npm run build
```

Expected: Build completes without errors.

- [ ] **Step 3: Manual smoke test**

1. Open `/admin/login` — domain hint should be gone, any email accepted
2. Open `/admin/signup` — type a non-invited email → red "Keine Einladung" hint appears
3. Log in as admin → all 8 sidebar items visible
4. Navigate to `/admin/users` → invite form + tables visible
5. Create an invite for a test email
6. Sign up with that email → green "Einladung gefunden" hint appears → complete signup → lands on `/admin` (or `/admin/media` if creator role)
7. Log in as creator → only Media, AI-Lab, Post Content, User & Roles hidden ✓
8. Manually navigate to `/admin` as creator → redirected to `/admin/media`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: creator interface complete — roles, invites, new pages"
```
