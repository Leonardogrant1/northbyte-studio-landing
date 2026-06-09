# Support Ticket System — Design Spec

**Date:** 2026-06-08  
**Scope:** Ticket DB persistence, incrementing ticket numbers, per-ticket chat, support dashboard at `/admin/support`.

---

## Overview

Replace the email-only ticket route with a full ticket system backed by Convex. Tickets are created by external app users via the existing `/api/tickets/create` API route (email notification is retained). Support users and admins manage tickets through a new dashboard at `/admin/support`. Each ticket has its own chat thread; only support users and admins can post messages.

---

## 1. Schema Changes (`convex/schema.ts`)

### `ticket_counter`
A single document used for atomic ticket number generation.

```ts
ticket_counter: defineTable({
    value: v.number(),
})
```

### `tickets`
```ts
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
    .index("by_number", ["ticketNumber"])
```

### `ticket_messages`
```ts
ticket_messages: defineTable({
    ticketId:  v.id("tickets"),
    authorId:  v.id("users"),
    body:      v.string(),
    createdAt: v.number(),
})
    .index("by_ticket", ["ticketId"])
```

---

## 2. Convex Backend

### `convex/tickets/mutations.ts`

**`create({ appId, externalUserId, email?, title, description })`**
- No auth check (public-facing, called from Next.js API route via `ConvexHttpClient`)
- Atomically increments `ticket_counter` value (initialises to 1 if document doesn't exist)
- Inserts ticket with `status: "open"`, `waitingOn: "support"`, `ticketNumber` from counter
- Returns the new `ticketId` and `ticketNumber`

**`close({ ticketId })`**
- Caller must be admin or support user assigned to the ticket's app
- Sets `status: "closed"`, `updatedAt: now`

**`reopen({ ticketId })`**
- Caller must be admin or support user assigned to the ticket's app
- Sets `status: "open"`, `waitingOn: "support"`, `updatedAt: now`

### `convex/tickets/queries.ts`

**`getForSupportUser({})`**
- Caller must be admin or support
- If admin: returns all tickets (ordered by `createdAt` desc)
- If support: looks up caller's `support_assignments`, returns only tickets whose `appId` is in the assigned set

**`getById({ ticketId })`**
- Caller must be admin or support user assigned to the ticket's app
- Returns ticket document

### `convex/ticket_messages/mutations.ts`

**`send({ ticketId, body })`**
- Caller must be admin or support user assigned to the ticket's app
- Inserts message with `authorId: caller._id`
- Sets ticket `waitingOn: "user"` automatically
- Updates ticket `updatedAt: now`

### `convex/ticket_messages/queries.ts`

**`getForTicket({ ticketId })`**
- Caller must be admin or support user assigned to the ticket's app
- Returns all messages for the ticket ordered by `createdAt` asc

---

## 3. API Route — `/api/tickets/create`

**Modify** `src/app/api/tickets/create/route.ts`:

- Keep existing email logic unchanged
- After email: use `ConvexHttpClient` to call `tickets.mutations.create`
- Return `{ success: true, ticketId, ticketNumber }` instead of just `{ success: true }`
- If Convex call fails, still return success (email was sent) but log the error

```ts
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const { ticketId, ticketNumber } = await convex.mutation(api.tickets.mutations.create, {
    appId,          // resolved from appSlug via a Convex query
    externalUserId: userId,
    email,
    title,
    description,
});
```

**Note:** The route receives `appSlug` but Convex needs `appId`. The route must look up the app by slug first using `ConvexHttpClient` and `api.apps.queries.getBySlug`.

---

## 4. Support Dashboard

### `/admin/support` — Ticket List

**File:** `src/app/admin/(dashboard)/support/page.tsx`

- Fetches tickets via `api.tickets.queries.getForSupportUser` (real-time with `useQuery`)
- Filter tabs: **Alle** | **Warten auf uns** (`waitingOn === "support"`) | **Warten auf User** (`waitingOn === "user"`) | **Geschlossen** (`status === "closed"`)
- Table columns: `#Nr` | Titel | App | `waitingOn` badge | Datum
- Row click navigates to `/admin/support/[ticketId]`

### `/admin/support/[ticketId]` — Ticket Detail + Chat

**File:** `src/app/admin/(dashboard)/support/[ticketId]/page.tsx`

- Fetches ticket via `api.tickets.queries.getById`
- Fetches messages via `api.ticket_messages.queries.getForTicket` (real-time)
- **Header:** `#Nr` — Titel, App-Name, External User ID, E-Mail, Status badge
- **Chat area:** Scrollable message list (author name + timestamp per message), text input + send button at bottom
- **Actions:** "Schließen" button (if open) or "Wieder öffnen" button (if closed)
- Sending a message calls `api.ticket_messages.mutations.send` → auto-sets `waitingOn: "user"`

### Access

Both routes are accessible to `admin` and `support` user types. The existing `RoleGuard` (`isSupportAllowedRoute`) already matches `/admin/support/*` — no changes needed.

---

## 5. Auth Helper Pattern

Several backend functions need to check "is caller admin OR support user assigned to this app?" This logic is repeated across `close`, `reopen`, `getById`, `getForTicket`, and `send`. Extract a shared helper in `convex/tickets/_helpers.ts`:

```ts
export async function assertTicketAccess(
    ctx: QueryCtx | MutationCtx,
    ticketId: Id<"tickets">
): Promise<{ caller: Doc<"users">; ticket: Doc<"tickets"> }> { ... }
```

---

## Out of Scope (this phase)

- Email notifications to support users when a new ticket arrives
- File attachments in chat messages
- Ticket assignment to specific support users (currently visible to all assigned to the app)
- Pagination on the ticket list
