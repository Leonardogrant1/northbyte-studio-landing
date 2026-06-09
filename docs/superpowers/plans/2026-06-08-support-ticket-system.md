# Support Ticket System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the email-only `/api/tickets/create` route with a full ticket system — DB persistence, incrementing ticket numbers, per-ticket chat, and a support dashboard at `/admin/support`.

**Architecture:** Convex handles all data (tickets, messages, atomic counter). The existing Next.js API route gains a `ConvexHttpClient` call after the email send. Support/admin users manage tickets through two new Next.js pages. Queries return pre-joined data (app names, author names) to avoid N+1 client-side lookups.

**Tech Stack:** Convex (schema, mutations, queries), Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide icons, Sonner toasts, `ConvexHttpClient` for server-side Convex calls.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `convex/schema.ts` | Add `ticket_counter`, `tickets`, `ticket_messages` tables |
| Create | `convex/tickets/_helpers.ts` | Shared auth helper: `getCallerAndTicket` |
| Create | `convex/tickets/mutations.ts` | `create`, `close`, `reopen` |
| Create | `convex/tickets/queries.ts` | `getForSupportUser`, `getById` |
| Create | `convex/ticket_messages/mutations.ts` | `send` |
| Create | `convex/ticket_messages/queries.ts` | `getForTicket` |
| Modify | `src/app/api/tickets/create/route.ts` | Add ConvexHttpClient call after email |
| Modify | `src/app/admin/(dashboard)/support/page.tsx` | Ticket list with filter tabs |
| Create | `src/app/admin/(dashboard)/support/[ticketId]/page.tsx` | Ticket detail + chat |

---

## Task 1: Schema — Add ticket tables

**Files:**
- Modify: `convex/schema.ts` (add 3 tables before closing `});`)

- [ ] **Step 1: Add the three new tables**

In `convex/schema.ts`, replace the closing `});` on the last line with:

```ts
    ticket_counter: defineTable({
        value: v.number(),
    }),

    tickets: defineTable({
        ticketNumber:   v.number(),
        appId:          v.id("apps"),
        externalUserId: v.string(),
        email:          v.optional(v.string()),
        title:          v.string(),
        description:    v.string(),
        status:         v.union(v.literal("open"), v.literal("closed")),
        waitingOn:      v.union(v.literal("support"), v.literal("user")),
        createdAt:      v.number(),
        updatedAt:      v.number(),
    })
        .index("by_app",    ["appId"])
        .index("by_status", ["status"])
        .index("by_number", ["ticketNumber"]),

    ticket_messages: defineTable({
        ticketId:  v.id("tickets"),
        authorId:  v.id("users"),
        body:      v.string(),
        createdAt: v.number(),
    })
        .index("by_ticket", ["ticketId"]),
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add ticket_counter, tickets, and ticket_messages tables to schema"
```

---

## Task 2: Auth helper

**Files:**
- Create: `convex/tickets/_helpers.ts`

- [ ] **Step 1: Create the file**

```ts
import { DatabaseReader } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

/**
 * Resolves the caller's user document and the target ticket, then asserts
 * that the caller is either an admin or a support user assigned to the
 * ticket's app. Throws on any failure.
 */
export async function getCallerAndTicket(
  db: DatabaseReader,
  clerkId: string,
  ticketId: Id<"tickets">
): Promise<{ caller: Doc<"users">; ticket: Doc<"tickets"> }> {
  const caller = await db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!caller) throw new Error("Unauthenticated");

  const ticket = await db.get(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  if (caller.type === "admin") return { caller, ticket };

  if (caller.type !== "support") throw new Error("Unauthorized");

  const assignment = await db
    .query("support_assignments")
    .withIndex("by_user", (q) => q.eq("userId", caller._id))
    .filter((q) => q.eq(q.field("appId"), ticket.appId))
    .first();
  if (!assignment) throw new Error("Unauthorized");

  return { caller, ticket };
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/tickets/_helpers.ts
git commit -m "feat: add shared getCallerAndTicket auth helper for ticket access"
```

---

## Task 3: Ticket mutations

**Files:**
- Create: `convex/tickets/mutations.ts`

- [ ] **Step 1: Create the file**

```ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCallerAndTicket } from "./_helpers";

// Public-facing — no auth check. Called from Next.js API route via ConvexHttpClient.
// Atomically increments the ticket counter and inserts the ticket.
export const create = mutation({
  args: {
    appId:          v.id("apps"),
    externalUserId: v.string(),
    email:          v.optional(v.string()),
    title:          v.string(),
    description:    v.string(),
  },
  handler: async (ctx, args) => {
    // Atomic counter increment
    const counter = await ctx.db.query("ticket_counter").first();
    let ticketNumber: number;
    if (!counter) {
      ticketNumber = 1;
      await ctx.db.insert("ticket_counter", { value: 1 });
    } else {
      ticketNumber = counter.value + 1;
      await ctx.db.patch(counter._id, { value: ticketNumber });
    }

    const now = Date.now();
    const ticketId = await ctx.db.insert("tickets", {
      ticketNumber,
      appId:          args.appId,
      externalUserId: args.externalUserId,
      email:          args.email,
      title:          args.title,
      description:    args.description,
      status:         "open",
      waitingOn:      "support",
      createdAt:      now,
      updatedAt:      now,
    });

    return { ticketId, ticketNumber };
  },
});

// Admin or assigned support — close a ticket.
export const close = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { ticket } = await getCallerAndTicket(ctx.db, identity.subject, args.ticketId);
    await ctx.db.patch(ticket._id, { status: "closed", updatedAt: Date.now() });
  },
});

// Admin or assigned support — reopen a closed ticket.
export const reopen = mutation({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { ticket } = await getCallerAndTicket(ctx.db, identity.subject, args.ticketId);
    await ctx.db.patch(ticket._id, { status: "open", waitingOn: "support", updatedAt: Date.now() });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tickets/mutations.ts
git commit -m "feat: add ticket mutations (create, close, reopen)"
```

---

## Task 4: Ticket queries

**Files:**
- Create: `convex/tickets/queries.ts`

Queries return pre-joined data (with `appName`) so the UI doesn't need extra lookups.

- [ ] **Step 1: Create the file**

```ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCallerAndTicket } from "./_helpers";

// Returns all tickets the caller is allowed to see, with app name resolved.
// Admins see all; support users see only tickets for their assigned apps.
export const getForSupportUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const caller = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!caller || (caller.type !== "admin" && caller.type !== "support")) {
      throw new Error("Unauthorized");
    }

    let tickets;
    if (caller.type === "admin") {
      tickets = await ctx.db.query("tickets").order("desc").collect();
    } else {
      const assignments = await ctx.db
        .query("support_assignments")
        .withIndex("by_user", (q) => q.eq("userId", caller._id))
        .collect();
      const assignedAppIds = new Set(assignments.map((a) => a.appId));
      const all = await ctx.db.query("tickets").order("desc").collect();
      tickets = all.filter((t) => assignedAppIds.has(t.appId));
    }

    return Promise.all(
      tickets.map(async (t) => {
        const app = await ctx.db.get(t.appId);
        return { ...t, appName: app?.name ?? "Unknown" };
      })
    );
  },
});

// Returns a single ticket with app name resolved.
// Caller must be admin or support user assigned to the ticket's app.
export const getById = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { ticket } = await getCallerAndTicket(ctx.db, identity.subject, args.ticketId);
    const app = await ctx.db.get(ticket.appId);
    return { ...ticket, appName: app?.name ?? "Unknown" };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/tickets/queries.ts
git commit -m "feat: add ticket queries (getForSupportUser, getById)"
```

---

## Task 5: Ticket message mutation

**Files:**
- Create: `convex/ticket_messages/mutations.ts`

- [ ] **Step 1: Create the file**

```ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCallerAndTicket } from "../tickets/_helpers";

// Send a message in a ticket chat. Sets waitingOn to "user" automatically.
// Caller must be admin or support user assigned to the ticket's app.
export const send = mutation({
  args: {
    ticketId: v.id("tickets"),
    body:     v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const { caller, ticket } = await getCallerAndTicket(ctx.db, identity.subject, args.ticketId);

    const now = Date.now();
    await ctx.db.insert("ticket_messages", {
      ticketId:  ticket._id,
      authorId:  caller._id,
      body:      args.body,
      createdAt: now,
    });

    // Auto-switch: support replied → waiting on user
    await ctx.db.patch(ticket._id, { waitingOn: "user", updatedAt: now });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/ticket_messages/mutations.ts
git commit -m "feat: add ticket_messages send mutation with auto waitingOn toggle"
```

---

## Task 6: Ticket message query

**Files:**
- Create: `convex/ticket_messages/queries.ts`

Returns messages with the author's display name resolved.

- [ ] **Step 1: Create the file**

```ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCallerAndTicket } from "../tickets/_helpers";

// Returns all messages for a ticket, ordered oldest-first, with author name resolved.
// Caller must be admin or support user assigned to the ticket's app.
export const getForTicket = query({
  args: { ticketId: v.id("tickets") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await getCallerAndTicket(ctx.db, identity.subject, args.ticketId);

    const messages = await ctx.db
      .query("ticket_messages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();

    return Promise.all(
      messages.map(async (m) => {
        const author = await ctx.db.get(m.authorId);
        const authorName = [author?.name, author?.lastName].filter(Boolean).join(" ") || author?.email || "Support";
        return { ...m, authorName };
      })
    );
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/ticket_messages/queries.ts
git commit -m "feat: add ticket_messages getForTicket query with resolved author names"
```

---

## Task 7: Update `/api/tickets/create` route

**Files:**
- Modify: `src/app/api/tickets/create/route.ts`

- [ ] **Step 1: Replace the entire file**

```ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, appSlug, title, description, email } = body as {
      userId:      string;
      appSlug:     string;
      title:       string;
      description: string;
      email?:      string;
    };

    if (!userId || !appSlug || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: userId, appSlug, title, description" },
        { status: 400 }
      );
    }

    // --- Email (unchanged) ---
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: emailUser, pass: emailPass },
        });
        await transporter.sendMail({
          from: emailUser,
          to: "info@northbyte.studio",
          subject: `[Ticket] ${appSlug}: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
                New Ticket Created
              </h2>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">User ID:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${userId}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Email:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${email ?? "—"}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">App:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${appSlug}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Title:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${title}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Description:</h4>
                <div style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${description}</div>
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                <p>This ticket was submitted via the Northbyte Studio API.</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send ticket email:", emailErr);
        // Non-fatal — continue to DB insert
      }
    }

    // --- Convex DB insert ---
    // Resolve appSlug → appId
    const app = await convex.query(api.apps.queries.getBySlug, { slug: appSlug });
    if (!app) {
      return NextResponse.json({ error: `App not found: ${appSlug}` }, { status: 400 });
    }

    const { ticketId, ticketNumber } = await convex.mutation(api.tickets.mutations.create, {
      appId:          app._id,
      externalUserId: userId,
      email,
      title,
      description,
    });

    return NextResponse.json(
      { success: true, ticketId, ticketNumber },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/tickets/create/route.ts
git commit -m "feat: persist tickets to Convex DB in tickets/create route"
```

---

## Task 8: Support dashboard — Ticket list page

**Files:**
- Modify: `src/app/admin/(dashboard)/support/page.tsx`

Replace the placeholder with the real ticket list.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type FilterTab = "all" | "waiting_support" | "waiting_user" | "closed";

const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",             label: "Alle" },
    { key: "waiting_support", label: "Warten auf uns" },
    { key: "waiting_user",    label: "Warten auf User" },
    { key: "closed",          label: "Geschlossen" },
];

export default function SupportPage() {
    const currentUser = useCurrentUser();
    const isAllowed = currentUser?.type === "admin" || currentUser?.type === "support";
    const tickets = useQuery(api.tickets.queries.getForSupportUser, isAllowed ? {} : "skip");
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<FilterTab>("all");

    const filtered = (tickets ?? []).filter((t) => {
        if (activeTab === "waiting_support") return t.status === "open" && t.waitingOn === "support";
        if (activeTab === "waiting_user")    return t.status === "open" && t.waitingOn === "user";
        if (activeTab === "closed")          return t.status === "closed";
        return true;
    });

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
        <div className="max-w-4xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-1">Support</h1>
                <p className="text-secondary">Ticket-Anfragen verwalten.</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 border-b border-border">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? "border-accent text-accent"
                                : "border-transparent text-secondary hover:text-primary"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {tickets === undefined ? (
                <div className="flex items-center gap-2 text-secondary text-sm">
                    <Loader2 size={14} className="animate-spin" /> Wird geladen…
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-secondary text-sm">Keine Tickets vorhanden.</p>
            ) : (
                <div className="border border-border rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-surface2/30">
                                <th className="text-left px-4 py-3 text-secondary font-medium w-16">#</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Titel</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">App</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Datum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((ticket) => (
                                <tr
                                    key={ticket._id}
                                    onClick={() => router.push(`/admin/support/${ticket._id}`)}
                                    className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3 text-secondary font-mono text-xs">#{ticket.ticketNumber}</td>
                                    <td className="px-4 py-3 text-primary font-medium">{ticket.title}</td>
                                    <td className="px-4 py-3 text-secondary">{ticket.appName}</td>
                                    <td className="px-4 py-3">
                                        {ticket.status === "closed" ? (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-border/50 text-secondary">
                                                Geschlossen
                                            </span>
                                        ) : ticket.waitingOn === "support" ? (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                                                Warten auf uns
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                                                Warten auf User
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-secondary">{formatDate(ticket.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/admin/(dashboard)/support/page.tsx'
git commit -m "feat: implement support ticket list page with filter tabs"
```

---

## Task 9: Support dashboard — Ticket detail + chat page

**Files:**
- Create: `src/app/admin/(dashboard)/support/[ticketId]/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const ticketId = params.ticketId as Id<"tickets">;

    const currentUser = useCurrentUser();
    const isAllowed = currentUser?.type === "admin" || currentUser?.type === "support";

    const ticket  = useQuery(api.tickets.queries.getById,              isAllowed ? { ticketId } : "skip");
    const messages = useQuery(api.ticket_messages.queries.getForTicket, isAllowed ? { ticketId } : "skip");
    const closeMutation  = useMutation(api.tickets.mutations.close);
    const reopenMutation = useMutation(api.tickets.mutations.reopen);
    const sendMutation   = useMutation(api.ticket_messages.mutations.send);

    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [closing, setClosing] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to newest message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages?.length]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;
        setSending(true);
        try {
            await sendMutation({ ticketId, body: body.trim() });
            setBody("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Senden.");
        } finally {
            setSending(false);
        }
    };

    const handleClose = async () => {
        setClosing(true);
        try {
            await closeMutation({ ticketId });
            toast.success("Ticket geschlossen.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler.");
        } finally {
            setClosing(false);
        }
    };

    const handleReopen = async () => {
        setClosing(true);
        try {
            await reopenMutation({ ticketId });
            toast.success("Ticket wieder geöffnet.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler.");
        } finally {
            setClosing(false);
        }
    };

    const formatTime = (ts: number) =>
        new Date(ts).toLocaleString("de-DE", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });

    if (ticket === undefined || messages === undefined) {
        return (
            <div className="flex items-center gap-2 text-secondary text-sm">
                <Loader2 size={14} className="animate-spin" /> Wird geladen…
            </div>
        );
    }

    if (ticket === null) {
        return <p className="text-secondary text-sm">Ticket nicht gefunden.</p>;
    }

    return (
        <div className="max-w-3xl space-y-6">
            {/* Back */}
            <button
                onClick={() => router.push("/admin/support")}
                className="flex items-center gap-2 text-secondary hover:text-primary text-sm transition-colors"
            >
                <ArrowLeft size={16} /> Zurück zur Übersicht
            </button>

            {/* Ticket Header */}
            <div className="bg-surface2/50 border border-border rounded-2xl p-6 space-y-3">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs text-secondary font-mono mb-1">#{ticket.ticketNumber}</p>
                        <h1 className="text-xl font-bold">{ticket.title}</h1>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {ticket.status === "closed" ? (
                            <>
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-border/50 text-secondary">
                                    Geschlossen
                                </span>
                                <button
                                    onClick={handleReopen}
                                    disabled={closing}
                                    className="px-4 py-2 text-sm border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                                >
                                    Wieder öffnen
                                </button>
                            </>
                        ) : (
                            <>
                                {ticket.waitingOn === "support" ? (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
                                        Warten auf uns
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                                        Warten auf User
                                    </span>
                                )}
                                <button
                                    onClick={handleClose}
                                    disabled={closing}
                                    className="px-4 py-2 text-sm border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                                >
                                    Schließen
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm pt-2 border-t border-border">
                    <div>
                        <p className="text-xs text-secondary mb-0.5">App</p>
                        <p className="text-primary">{ticket.appName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-secondary mb-0.5">User ID</p>
                        <p className="text-primary font-mono text-xs">{ticket.externalUserId}</p>
                    </div>
                    {ticket.email && (
                        <div>
                            <p className="text-xs text-secondary mb-0.5">E-Mail</p>
                            <p className="text-primary">{ticket.email}</p>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-border">
                    <p className="text-xs text-secondary mb-1">Beschreibung</p>
                    <p className="text-sm text-primary whitespace-pre-wrap">{ticket.description}</p>
                </div>
            </div>

            {/* Chat */}
            <div className="border border-border rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border bg-surface2/30">
                    <p className="text-sm font-medium">Verlauf</p>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                    {messages.length === 0 ? (
                        <p className="text-secondary text-sm text-center py-4">Noch keine Nachrichten.</p>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg._id} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-accent">{msg.authorName}</span>
                                    <span className="text-xs text-secondary">{formatTime(msg.createdAt)}</span>
                                </div>
                                <p className="text-sm text-primary bg-surface2/50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                                    {msg.body}
                                </p>
                            </div>
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Send form — only shown when ticket is open */}
                {ticket.status === "open" && (
                    <form
                        onSubmit={handleSend}
                        className="flex items-end gap-2 p-4 border-t border-border bg-surface2/20"
                    >
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Nachricht schreiben…"
                            disabled={sending}
                            rows={2}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e as unknown as React.FormEvent);
                                }
                            }}
                            className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-2 text-primary text-sm resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={sending || !body.trim()}
                            className="p-2.5 bg-accent text-background rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'src/app/admin/(dashboard)/support/[ticketId]/page.tsx'
git commit -m "feat: implement ticket detail page with chat and close/reopen actions"
```

---

## Task 10: TypeScript verification

**Files:** No changes — verification only.

- [ ] **Step 1: Run tsc**

```bash
cd /Users/leonardogranetto/Projects/northbyte_studio && npx tsc --noEmit 2>&1 | grep -v "support_assignments\|api\.tickets\|api\.ticket_messages" | grep "error TS" | head -20
```

Expected: no output (zero unexpected errors). Errors mentioning `api.tickets`, `api.ticket_messages`, or `api.support_assignments` are expected — they will resolve when `npx convex dev` regenerates `_generated/api.d.ts`.

- [ ] **Step 2: Fix any unexpected errors and commit**

If there are unexpected errors (not in the API generated types), fix them and commit:
```bash
git add <files>
git commit -m "fix: resolve TypeScript errors in support ticket system"
```

If only expected generated-types errors remain, no commit is needed.

---

## Completion Checklist

- [ ] `convex/schema.ts` has `ticket_counter`, `tickets`, `ticket_messages` tables
- [ ] `convex/tickets/_helpers.ts` exports `getCallerAndTicket`
- [ ] `convex/tickets/mutations.ts` exports `create`, `close`, `reopen`
- [ ] `convex/tickets/queries.ts` exports `getForSupportUser`, `getById` (with `appName`)
- [ ] `convex/ticket_messages/mutations.ts` exports `send` (auto-toggles `waitingOn`)
- [ ] `convex/ticket_messages/queries.ts` exports `getForTicket` (with `authorName`)
- [ ] `/api/tickets/create` resolves slug → appId, calls `tickets.mutations.create`, returns `ticketId` + `ticketNumber`
- [ ] `/admin/support` renders ticket list with 4 filter tabs
- [ ] `/admin/support/[ticketId]` renders ticket detail + chat + close/reopen
- [ ] `tsc --noEmit` has zero unexpected errors
