# Flat-Affiliates + Admin-Übersicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neuer `commissionType: "flat"` für Pauschal-Deal-Affiliates ohne User-Account (optionale `userId`), plus neuer Admin-Tab `/admin/affiliates` mit tabellarischen Stats aller Affiliates.

**Architecture:** Convex-Backend (`packages/backend/convex/`) bekommt ein erweitertes Schema, eine extrahierte Stats-Helper-Funktion (von `getMyStats` und der neuen Admin-Query `getAllWithStats` gemeinsam genutzt) und neue admin-only Mutations (`createStandalone`, `removeStandalone`, erweitertes `update`). Frontend (Next.js in `apps/web/`) bekommt eine neue Admin-Seite mit Tabelle + Dialogen sowie einen Flat-Edge-Case im bestehenden Affiliate-Dashboard.

**Tech Stack:** Convex 1.39 (Schema/Queries/Mutations), Next.js 16 App Router, Convex React Hooks, Tailwind, lucide-react, sonner.

**Spec:** `docs/superpowers/specs/2026-07-21-flat-affiliates-admin-overview-design.md`

## Global Constraints

- **KEINE git commits/pushes durch Agents** — der User übernimmt alle Git-Operationen selbst. Alle Commit-Schritte entfallen; stattdessen am Task-Ende den Typecheck laufen lassen.
- Kein Test-Framework im Repo vorhanden — Verifikation pro Task via TypeScript-Typecheck, finale Verifikation manuell (Task 6).
- UI-Texte auf Deutsch, bestehende Tailwind-Klassen-Idiome übernehmen (`bg-surface2/50 border border-border rounded-2xl` etc.).
- Fehlermeldungen in Mutations auf Deutsch, Muster: `throw new Error("...")` → Frontend fängt mit `toast.error(err instanceof Error ? err.message : "...")`.
- Admin-Check-Muster in allen neuen Convex-Funktionen exakt wie bestehend (siehe `affiliate_profiles/mutations.ts:14-21`): Identity → User via `by_clerk` → `type !== "admin"` → throw (Mutations) bzw. `return null` (Queries).
- Typecheck-Kommandos:
  - Backend: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter @repo/backend codegen && pnpm --filter @repo/backend exec tsc --noEmit`
  - Web: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter web exec tsc --noEmit`

---

### Task 1: Schema erweitern

**Files:**
- Modify: `packages/backend/convex/schema.ts:18-24`

**Interfaces:**
- Consumes: —
- Produces: `affiliate_profiles`-Doc mit `userId?: Id<"users">`, `name?: string`, `commissionType: "percentage" | "fixed" | "flat"`. Alle späteren Tasks bauen auf diesen generierten Typen (`Doc<"affiliate_profiles">`) auf.

- [ ] **Step 1: Schema ändern**

In `packages/backend/convex/schema.ts` den Block ersetzen:

Alt (Zeilen 18–24):
```typescript
    affiliate_profiles: defineTable({
        userId: v.id("users"),
        affiliateCode: v.string(),
        commissionType: v.union(v.literal("percentage"), v.literal("fixed")),
        commissionAmount: v.number(),
        isActive: v.boolean(),
    }).index("by_user", ["userId"]),
```

Neu:
```typescript
    affiliate_profiles: defineTable({
        userId: v.optional(v.id("users")),   // undefined = Standalone-Profil (Pauschal-Deal ohne Login)
        name: v.optional(v.string()),        // Anzeigename für Standalone-Profile; sonst kommt der Name aus users
        affiliateCode: v.string(),
        commissionType: v.union(v.literal("percentage"), v.literal("fixed"), v.literal("flat")),
        commissionAmount: v.number(),        // bei "flat": gezahlter Deal-Betrag (nur Info, keine Provisionsberechnung)
        isActive: v.boolean(),
    }).index("by_user", ["userId"]),
```

- [ ] **Step 2: Codegen + Typecheck Backend**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter @repo/backend codegen && pnpm --filter @repo/backend exec tsc --noEmit`
Expected: Exit 0, keine Fehler. (Alle Änderungen sind additiv/aufweichend — bestehender Code compiliert weiter.)

---

### Task 2: Stats-Helper extrahieren + Admin-Query `getAllWithStats`

**Files:**
- Create: `packages/backend/convex/affiliate_profiles/stats.ts`
- Modify: `packages/backend/convex/affiliate_profiles/queries.ts`

**Interfaces:**
- Consumes: Schema aus Task 1 (`Doc<"affiliate_profiles">` mit optionalem `userId`/`name`, `flat`-Typ).
- Produces:
  - `computeStats(profile: Doc<"affiliate_profiles">, allReferrals: Doc<"affiliate_referral">[], filter: { fromMs?: number; toMs?: number; environment?: string }): AffiliateStats` mit `AffiliateStats = { earned: number | null; referredUsers: number; convertedUsers: number; conversionRate: number; cancelRate: number; refundRate: number }` — `earned` ist `null` bei `commissionType === "flat"`.
  - Query `api.affiliate_profiles.queries.getAllWithStats({ fromMs?, toMs?, environment? })` (admin-only, sonst `null`). Rückgabe: Array von `{ profileId, name: string, email: string | null, affiliateCode: string, commissionType: "percentage" | "fixed" | "flat", commissionAmount: number, isActive: boolean, isStandalone: boolean, stats: AffiliateStats }`.
  - `getMyStats` liefert unverändert dieselben Felder, aber `earned` ist jetzt typisiert als `number | null` (praktisch `null` nur bei flat).

- [ ] **Step 1: Helper-Datei anlegen**

Create `packages/backend/convex/affiliate_profiles/stats.ts`:

```typescript
import { Doc } from "../_generated/dataModel";

export interface StatsFilter {
  fromMs?: number;
  toMs?: number;
  environment?: string;
}

export interface AffiliateStats {
  earned: number | null; // null bei "flat" — Pauschale hat keine Provisionsberechnung
  referredUsers: number;
  convertedUsers: number;
  conversionRate: number;
  cancelRate: number;
  refundRate: number;
}

// Gemeinsame Stats-Berechnung für das Affiliate-Dashboard (getMyStats)
// und die Admin-Übersicht (getAllWithStats), damit beide identisch rechnen.
export function computeStats(
  profile: Doc<"affiliate_profiles">,
  allReferrals: Doc<"affiliate_referral">[],
  filter: StatsFilter,
): AffiliateStats {
  const referrals = allReferrals.filter((r) => {
    if (filter.fromMs !== undefined && r.createdAt < filter.fromMs) return false;
    if (filter.toMs !== undefined && r.createdAt > filter.toMs) return false;
    if (filter.environment !== undefined && (r.environment ?? "PRODUCTION") !== filter.environment) return false;
    return true;
  });

  const converted = referrals.filter((r) => r.convertedAt !== undefined);
  const cancelled = referrals.filter((r) => r.cancelledAt !== undefined);
  const refunded = referrals.filter((r) => r.refundedAt !== undefined);
  // hasConverted=true: first payment received and not refunded — affiliate is owed commission
  const earnedReferrals = referrals.filter((r) => r.hasConverted === true);

  // Earnings: commission on developer takehome (after store cut), only for non-refunded conversions.
  // takehome = price * takehomePercentage (e.g. 58.93 * 0.85 = 50.09 USD)
  let earned: number | null = null;
  if (profile.commissionType !== "flat") {
    earned = earnedReferrals.reduce((sum, r) => {
      if (!r.price) return sum;
      const takehome = r.price * (r.takehomePercentage ?? 1);
      if (profile.commissionType === "percentage") {
        return sum + (takehome * profile.commissionAmount) / 100;
      }
      return sum + profile.commissionAmount;
    }, 0);
  }

  const referredCount = referrals.length;
  const convertedCount = converted.length;

  return {
    earned,
    referredUsers: referredCount,
    convertedUsers: convertedCount,
    conversionRate: referredCount > 0 ? (convertedCount / referredCount) * 100 : 0,
    cancelRate: convertedCount > 0 ? (cancelled.length / convertedCount) * 100 : 0,
    refundRate: convertedCount > 0 ? (refunded.length / convertedCount) * 100 : 0,
  };
}
```

- [ ] **Step 2: `getMyStats` auf den Helper umstellen**

In `packages/backend/convex/affiliate_profiles/queries.ts`: Import ergänzen und den Handler-Teil ab dem Referral-Fetch (bisherige Zeilen 28–68) durch den Helper-Aufruf ersetzen. Die Datei beginnt danach so:

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";
import { computeStats } from "./stats";

// Returns computed stats for the currently authenticated affiliate,
// filtered by an optional date range (fromMs / toMs = epoch ms on createdAt).
export const getMyStats = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    environment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const profile = await ctx.db
      .query("affiliate_profiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) return null;

    const allReferrals = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
      .collect();

    return computeStats(profile, allReferrals, args);
  },
});
```

`getMyProfile` und `getByUserId` bleiben unverändert.

- [ ] **Step 3: `getAllWithStats` anfügen**

Ans Ende von `packages/backend/convex/affiliate_profiles/queries.ts`:

```typescript
// Admin-only — all affiliate profiles (linked + standalone) with computed stats.
export const getAllWithStats = query({
  args: {
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    environment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || caller.type !== "admin") return null;

    const profiles = await ctx.db.query("affiliate_profiles").collect();

    return await Promise.all(
      profiles.map(async (profile) => {
        const user = profile.userId ? await ctx.db.get(profile.userId) : null;
        const referrals = await ctx.db
          .query("affiliate_referral")
          .withIndex("by_affiliate", (q) => q.eq("affiliateId", profile._id))
          .collect();

        const displayName = user
          ? [user.name, user.lastName].filter(Boolean).join(" ") || user.email || "—"
          : profile.name ?? "—";

        return {
          profileId: profile._id,
          name: displayName,
          email: user?.email ?? null,
          affiliateCode: profile.affiliateCode,
          commissionType: profile.commissionType,
          commissionAmount: profile.commissionAmount,
          isActive: profile.isActive,
          isStandalone: profile.userId === undefined,
          stats: computeStats(profile, referrals, args),
        };
      }),
    );
  },
});
```

- [ ] **Step 4: Typecheck Backend**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter @repo/backend codegen && pnpm --filter @repo/backend exec tsc --noEmit`
Expected: Exit 0.

Hinweis: `pnpm --filter web exec tsc --noEmit` schlägt nach diesem Task ggf. fehl, weil `stats.earned` jetzt `number | null` ist und das Dashboard `stats.earned.toLocaleString(...)` aufruft — das wird in Task 5 behoben. Web-Typecheck erst ab Task 5 als Gate verwenden.

---

### Task 3: Mutations — `createStandalone`, `removeStandalone`, `update` erweitern

**Files:**
- Modify: `packages/backend/convex/affiliate_profiles/mutations.ts`

**Interfaces:**
- Consumes: Schema aus Task 1.
- Produces:
  - `api.affiliate_profiles.mutations.createStandalone({ name: string, affiliateCode: string, commissionAmount: number })` → legt Standalone-Profil mit `commissionType: "flat"`, `isActive: true` an, gibt die neue Profil-Id zurück.
  - `api.affiliate_profiles.mutations.removeStandalone({ profileId: Id<"affiliate_profiles"> })` → löscht Standalone-Profil (wirft bei verknüpftem User oder vorhandenen Referrals).
  - `api.affiliate_profiles.mutations.update({ profileId, affiliateCode, commissionType: "percentage" | "fixed" | "flat", commissionAmount, isActive, name?: string })` — wie bisher, plus `flat` und optionales `name`.

- [ ] **Step 1: Datei komplett neu schreiben**

Replace `packages/backend/convex/affiliate_profiles/mutations.ts` mit:

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { MutationCtx } from "../_generated/server";

async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const caller = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!caller || caller.type !== "admin") throw new Error("Unauthorized");
  return caller;
}

// Code muss eindeutig sein über alle Profile UND offenen Invites hinweg.
async function assertCodeAvailable(ctx: MutationCtx, code: string, excludeProfileId?: string) {
  const codeInProfiles = await ctx.db
    .query("affiliate_profiles")
    .collect()
    .then((all) => all.some((p) => p.affiliateCode === code && p._id !== excludeProfileId));
  if (codeInProfiles) throw new Error(`Der Affiliate-Code "${code}" ist bereits vergeben.`);

  const openInvitesWithCode = await ctx.db
    .query("user_invites")
    .collect()
    .then((all) => all.some((i) => i.affiliateCode === code && i.usedAt === undefined));
  if (openInvitesWithCode) throw new Error(`Der Affiliate-Code "${code}" ist bereits in einer offenen Einladung vergeben.`);
}

// Admin-only — update commission settings and affiliate code for a profile.
export const update = mutation({
  args: {
    profileId: v.id("affiliate_profiles"),
    affiliateCode: v.string(),
    commissionType: v.union(v.literal("percentage"), v.literal("fixed"), v.literal("flat")),
    commissionAmount: v.number(),
    isActive: v.boolean(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Affiliate profile not found.");

    const code = args.affiliateCode.trim();
    if (!code) throw new Error("Affiliate-Code darf nicht leer sein.");
    if (code !== profile.affiliateCode) {
      await assertCodeAvailable(ctx, code, args.profileId);
    }

    await ctx.db.patch(args.profileId, {
      affiliateCode: code,
      commissionType: args.commissionType,
      commissionAmount: args.commissionAmount,
      isActive: args.isActive,
      ...(args.name !== undefined ? { name: args.name.trim() } : {}),
    });
  },
});

// Admin-only — create a standalone flat-deal profile (no user account, no login).
export const createStandalone = mutation({
  args: {
    name: v.string(),
    affiliateCode: v.string(),
    commissionAmount: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (!name) throw new Error("Name darf nicht leer sein.");
    const code = args.affiliateCode.trim();
    if (!code) throw new Error("Affiliate-Code darf nicht leer sein.");
    await assertCodeAvailable(ctx, code);

    return await ctx.db.insert("affiliate_profiles", {
      name,
      affiliateCode: code,
      commissionType: "flat",
      commissionAmount: args.commissionAmount,
      isActive: true,
    });
  },
});

// Admin-only — delete a standalone profile. Linked profiles must be deactivated instead.
export const removeStandalone = mutation({
  args: { profileId: v.id("affiliate_profiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("Affiliate-Profil nicht gefunden.");
    if (profile.userId !== undefined) {
      throw new Error("Profile mit verknüpftem User können nicht gelöscht werden — bitte deaktivieren.");
    }

    const hasReferrals = await ctx.db
      .query("affiliate_referral")
      .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.profileId))
      .first();
    if (hasReferrals) {
      throw new Error("Dieses Profil hat bereits Referrals und kann nicht gelöscht werden — bitte deaktivieren.");
    }

    await ctx.db.delete(args.profileId);
  },
});
```

Hinweis: `update` behält Namen und Verhalten für den bestehenden Aufrufer in `apps/web/src/app/admin/(dashboard)/users/page.tsx:42` bei (nur zusätzliche optionale/erweiterte Args — abwärtskompatibel).

- [ ] **Step 2: Typecheck Backend**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter @repo/backend codegen && pnpm --filter @repo/backend exec tsc --noEmit`
Expected: Exit 0.

---

### Task 4: Admin-Seite `/admin/affiliates` + Sidebar-Eintrag

**Files:**
- Create: `apps/web/src/app/admin/(dashboard)/affiliates/page.tsx`
- Modify: `apps/web/src/components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `api.affiliate_profiles.queries.getAllWithStats` (Task 2), `api.affiliate_profiles.mutations.createStandalone` / `update` / `removeStandalone` (Task 3).
- Produces: Admin-only Seite mit Stats-Tabelle, Anlegen-/Bearbeiten-Dialog, Löschen-Aktion.

- [ ] **Step 1: Sidebar-Eintrag ergänzen**

In `apps/web/src/components/admin/AdminSidebar.tsx`:

Import in Zeile 5 um `Percent` ergänzen:
```typescript
import { BarChart2, Bug, Lightbulb, AppWindow, Image, FlaskConical, FileEdit, Users, AtSign, Bot, LayoutList, TrendingUp, LayoutDashboard, Headphones, UserCheck, Percent } from "lucide-react";
```

Direkt nach dem "User & Roles"-Eintrag (nach Zeile 133, vor dem Affiliate-"Dashboard"-Eintrag) einfügen:
```typescript
        {
            label: "Affiliates",
            icon: Percent,
            href: "/admin/affiliates",
            isActive: pathname === "/admin/affiliates",
            adminOnly: true,
            affiliateOnly: false,
            creatorOnly: false,
        },
```

- [ ] **Step 2: Seite anlegen**

Create `apps/web/src/app/admin/(dashboard)/affiliates/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

type CommissionType = "percentage" | "fixed" | "flat";

interface AffiliateRow {
    profileId: Id<"affiliate_profiles">;
    name: string;
    email: string | null;
    affiliateCode: string;
    commissionType: CommissionType;
    commissionAmount: number;
    isActive: boolean;
    isStandalone: boolean;
    stats: {
        earned: number | null;
        referredUsers: number;
        convertedUsers: number;
        conversionRate: number;
        cancelRate: number;
        refundRate: number;
    };
}

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToStartOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function isoToEndOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatAmount(type: CommissionType, amount: number) {
    if (type === "percentage") return `${amount}%`;
    return `$${amount}`;
}

function typeLabel(type: CommissionType) {
    if (type === "percentage") return "Provision (%)";
    if (type === "fixed") return "Fix pro Conversion";
    return "Pauschale";
}

function CreateFlatDialog({ onClose }: { onClose: () => void }) {
    const createStandalone = useMutation(api.affiliate_profiles.mutations.createStandalone);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createStandalone({
                name: name.trim(),
                affiliateCode: code.trim(),
                commissionAmount: parseFloat(amount || "0"),
            });
            toast.success("Flat-Affiliate angelegt.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Flat-Affiliate anlegen</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="z.B. Max Mustermann"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Affiliate-Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            placeholder="z.B. maxpromo"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Deal-Betrag ($)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            placeholder="500"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
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
                            disabled={saving}
                            className="flex-1 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? "Wird angelegt…" : "Anlegen"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditAffiliateDialog({ row, onClose }: { row: AffiliateRow; onClose: () => void }) {
    const updateProfile = useMutation(api.affiliate_profiles.mutations.update);
    const [name, setName] = useState(row.name === "—" ? "" : row.name);
    const [code, setCode] = useState(row.affiliateCode);
    const [commissionType, setCommissionType] = useState<CommissionType>(row.commissionType);
    const [amount, setAmount] = useState(row.commissionAmount.toString());
    const [isActive, setIsActive] = useState(row.isActive);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile({
                profileId: row.profileId,
                affiliateCode: code.trim(),
                commissionType,
                commissionAmount: parseFloat(amount || "0"),
                isActive,
                name: row.isStandalone ? name.trim() : undefined,
            });
            toast.success("Affiliate gespeichert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Affiliate bearbeiten</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {row.isStandalone && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Affiliate-Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">Typ</label>
                            <select
                                value={commissionType}
                                onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                            >
                                <option value="percentage">Prozent (%)</option>
                                <option value="fixed">Fix pro Conversion ($)</option>
                                <option value="flat">Pauschale ($)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">
                                Betrag {commissionType === "percentage" ? "(%)" : "($)"}
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsActive((v) => !v)}
                            disabled={saving}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${isActive ? "bg-accent" : "bg-border"}`}
                        >
                            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                        <span className="text-sm text-secondary">{isActive ? "Aktiv" : "Inaktiv"}</span>
                    </div>
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
                            disabled={saving}
                            className="flex-1 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? "Wird gespeichert…" : "Speichern"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AffiliatesAdminPage() {
    const { isAuthenticated } = useConvexAuth();

    const today = todayIso();
    const defaultFrom = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(today);
    const [environment, setEnvironment] = useState<"PRODUCTION" | "SANDBOX">("PRODUCTION");

    const fromMs = useMemo(() => isoToStartOfDayMs(from), [from]);
    const toMs = useMemo(() => isoToEndOfDayMs(to), [to]);

    const rows = useQuery(
        api.affiliate_profiles.queries.getAllWithStats,
        isAuthenticated ? { fromMs, toMs, environment } : "skip",
    );

    const removeStandalone = useMutation(api.affiliate_profiles.mutations.removeStandalone);

    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<AffiliateRow | null>(null);

    const handleDelete = async (row: AffiliateRow) => {
        if (!window.confirm(`Flat-Affiliate "${row.name}" wirklich löschen?`)) return;
        try {
            await removeStandalone({ profileId: row.profileId });
            toast.success("Flat-Affiliate gelöscht.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
        }
    };

    return (
        <div className="max-w-6xl space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Affiliates</h1>
                    <p className="text-secondary">Alle Affiliates und ihre Performance im Überblick.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setEnvironment((e) => (e === "PRODUCTION" ? "SANDBOX" : "PRODUCTION"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${environment === "SANDBOX"
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                            : "border-border text-secondary hover:border-accent/50"
                            }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${environment === "SANDBOX" ? "bg-yellow-400" : "bg-green-400"}`} />
                        {environment === "SANDBOX" ? "Sandbox" : "Production"}
                    </button>
                    <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                    >
                        <Plus size={16} />
                        Flat-Affiliate anlegen
                    </button>
                </div>
            </div>

            {rows === undefined ? (
                <div className="flex items-center gap-2 text-secondary text-sm">
                    <Loader2 size={14} className="animate-spin" /> Wird geladen…
                </div>
            ) : rows === null ? (
                <p className="text-secondary text-sm">Kein Zugriff.</p>
            ) : rows.length === 0 ? (
                <p className="text-secondary text-sm">Keine Affiliates vorhanden.</p>
            ) : (
                <div className="border border-border rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-border bg-surface2/30">
                                <th className="text-left px-4 py-3 text-secondary font-medium">Name</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Code</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Typ</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Betrag</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Referred</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Converted</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Conv-Rate</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Cancel</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Refund</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Earned</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {(rows as AffiliateRow[]).map((row) => (
                                <tr key={row.profileId} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                    <td className="px-4 py-3 text-primary">
                                        {row.name}
                                        {row.email && <span className="block text-xs text-secondary">{row.email}</span>}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-primary">{row.affiliateCode}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${row.commissionType === "flat"
                                            ? "bg-orange-500/20 text-orange-400"
                                            : "bg-purple-500/20 text-purple-400"
                                            }`}>
                                            {typeLabel(row.commissionType)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary">{formatAmount(row.commissionType, row.commissionAmount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${row.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                            {row.isActive ? "Aktiv" : "Inaktiv"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.referredUsers}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.convertedUsers}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.conversionRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.cancelRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.refundRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">
                                        {row.stats.earned !== null
                                            ? `$${row.stats.earned.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setEditing(row)}
                                            className="text-secondary hover:text-accent transition-colors p-1"
                                            title="Bearbeiten"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        {row.isStandalone && (
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="text-secondary hover:text-red-400 transition-colors p-1"
                                                title="Löschen"
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

            {creating && <CreateFlatDialog onClose={() => setCreating(false)} />}
            {editing && <EditAffiliateDialog row={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
```

- [ ] **Step 3: Typecheck Web (erwartet: nur der bekannte Dashboard-Fehler)**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter web exec tsc --noEmit`
Expected: Kein Fehler in `affiliates/page.tsx` oder `AdminSidebar.tsx`. Ein Fehler in `affiliate/page.tsx` (Zeile ~156, `stats.earned` möglicherweise `null`) ist zu diesem Zeitpunkt erwartet und wird in Task 5 behoben.

---

### Task 5: Dashboard-Edge-Case (flat) + Edit-Modal auf der Users-Seite

**Files:**
- Modify: `apps/web/src/app/admin/(dashboard)/affiliate/page.tsx`
- Modify: `apps/web/src/app/admin/(dashboard)/users/page.tsx`

**Interfaces:**
- Consumes: `getMyStats` mit `earned: number | null` (Task 2), `update`-Mutation mit `flat` (Task 3).
- Produces: Dashboard zeigt bei `commissionType === "flat"` nur den Promo-Code (keine Stats, keine Stats-Query); Edit-Modal auf `/admin/users` unterstützt den `flat`-Typ.

- [ ] **Step 1: Affiliate-Dashboard anpassen**

In `apps/web/src/app/admin/(dashboard)/affiliate/page.tsx`:

1. Debug-Log entfernen (Zeile 54): `console.log("isAuthenticated", isAuthenticated);` löschen.

2. Nach der `profile`-Query (Zeile 56) einfügen:
```typescript
    const isFlat = profile?.commissionType === "flat";
```

3. Stats-Query (Zeile 72) so ändern, dass sie bei flat übersprungen wird:
```typescript
    const stats = useQuery(api.affiliate_profiles.queries.getMyStats, isAuthenticated && !isFlat ? { fromMs, toMs, environment } : "skip");
```

4. Im Header den Environment-Toggle und DateRangePicker nur ohne flat anzeigen — den `<div className="flex items-center gap-3">`-Block (Zeilen 100–112) wrappen:
```tsx
                {!isFlat && (
                    <div className="flex items-center gap-3">
                        {/* ... bestehender Toggle + DateRangePicker unverändert ... */}
                    </div>
                )}
```

5. Provisions-Block (Zeilen 137–149) flat-fähig machen — ersetzen durch:
```tsx
                {profile && (
                    <div className="sm:border-l sm:border-border sm:pl-6">
                        <p className="text-sm text-secondary font-medium mb-3">
                            {profile.commissionType === "flat" ? "Dein Deal" : "Deine Provision"}
                        </p>
                        <p className="text-2xl font-bold text-primary">
                            {profile.commissionType === "percentage"
                                ? `${profile.commissionAmount}%`
                                : `$${profile.commissionAmount}`}
                        </p>
                        <p className="text-xs text-secondary/70 mt-1">
                            {profile.commissionType === "percentage"
                                ? "Pro Conversion"
                                : profile.commissionType === "fixed"
                                ? "Fester Betrag"
                                : "Pauschale"}
                        </p>
                    </div>
                )}
```

6. Stats-Grid (die komplette `<section className="grid ...">`, Zeilen 153–196) nur ohne flat rendern — wrappen mit:
```tsx
            {!isFlat && (
                <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* ... bestehende StatCards unverändert ... */}
                </section>
            )}
```

7. Null-Safety für `earned` in der ersten StatCard (bisher Zeile 156) — `value` ersetzen durch:
```tsx
                    value={stats && stats.earned !== null ? `$${stats.earned.toLocaleString("de-DE", { minimumFractionDigits: 2 })}` : "—"}
```

- [ ] **Step 2: Edit-Modal auf der Users-Seite um `flat` erweitern**

In `apps/web/src/app/admin/(dashboard)/users/page.tsx`:

1. Typ-Definition (Zeile 12) ersetzen:
```typescript
type CommissionType = "percentage" | "fixed" | "flat";
type InviteCommissionType = "percentage" | "fixed";
```

2. Im `AffiliateEditModal`-Select (Zeilen 89–97) die dritte Option ergänzen:
```tsx
                                <select
                                    value={commissionType ?? "percentage"}
                                    onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                                    disabled={saving}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                                >
                                    <option value="percentage">Prozent (%)</option>
                                    <option value="fixed">Fix pro Conversion ($)</option>
                                    <option value="flat">Pauschale ($)</option>
                                </select>
```

3. Invite-Formular auf den engeren Typ umstellen (Invites bleiben bewusst auf percentage/fixed beschränkt — flat läuft über `/admin/affiliates`):
   - Zeile 333: `useState<CommissionType>("percentage")` → `useState<InviteCommissionType>("percentage")`
   - Zeile 489 (Select im Invite-Formular): `e.target.value as CommissionType` → `e.target.value as InviteCommissionType`
   - Zeile 536 (Typ-Annotation der Invite-Zeile): `commissionType?: CommissionType;` → `commissionType?: InviteCommissionType;`

- [ ] **Step 3: Typecheck Web**

Run: `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter web exec tsc --noEmit`
Expected: Exit 0, keine Fehler mehr (auch der Dashboard-Fehler aus Task 4 ist behoben).

---

### Task 6: Manuelle Verifikation

**Files:** — (nur Verifikation, keine Änderungen)

**Interfaces:**
- Consumes: Alle vorherigen Tasks.
- Produces: Verifizierte Feature-Funktionalität.

- [ ] **Step 1: Dev-Umgebung starten**

Run (zwei Terminals bzw. Hintergrund):
- `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter @repo/backend dev` (pusht Schema + Funktionen ins Convex-Dev-Deployment)
- `cd /Users/leonardogranetto/Projects/northbyte_studio && pnpm --filter web dev`

Expected: Convex dev pusht ohne Schema-Validierungsfehler; Next.js startet.

- [ ] **Step 2: Checkliste als Admin durchgehen**

1. `/admin/affiliates` erscheint in der Sidebar (nur als Admin) und lädt die Tabelle mit allen bestehenden Affiliates; Zahlen für einen bestehenden percentage-Affiliate stimmen mit dessen Dashboard überein (gleicher Zeitraum + Environment).
2. „Flat-Affiliate anlegen": Profil mit Name/Code/Betrag anlegen → erscheint in der Tabelle mit Typ „Pauschale", Earned „—".
3. Denselben Code erneut anlegen → Fehlertoast „bereits vergeben".
4. Flat-Affiliate bearbeiten (Name/Betrag ändern) und wieder löschen → funktioniert; Löschen eines verknüpften Profils ist nicht möglich (kein Button).
5. Referral auf den Flat-Code über `POST /api/affiliate/track` (Body: `{ appSlug, affiliateCode, environment: "SANDBOX" }`) → Referred-Zähler in der Admin-Tabelle steigt (Environment-Toggle auf Sandbox).
6. Als Affiliate-User mit percentage-Profil einloggen → Dashboard unverändert mit Stats.
7. (Falls testbar) Profil eines Test-Users per Edit-Modal auf „Pauschale" stellen → dessen Dashboard zeigt nur noch Promo-Code + „Dein Deal", keine Stats.
8. Invite-Flow auf `/admin/users` (percentage-Affiliate einladen) funktioniert unverändert.

- [ ] **Step 3: Abschluss**

Alle Punkte bestanden → Feature fertig. Der User committet die Änderungen selbst.
