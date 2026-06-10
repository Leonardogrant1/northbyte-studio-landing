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
    assets:         v.optional(v.array(v.string())),
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

    const messageId = `<ticket-${ticketNumber}@northbyte.studio>`;
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
      messageId,
      assets:         args.assets,
      createdAt:      now,
      updatedAt:      now,
    });

    return { ticketId, ticketNumber, messageId };
  },
});

// Internal — backfill messageId for old tickets that were created before email threading was added.
export const setMessageId = mutation({
  args: { ticketId: v.id("tickets"), messageId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ticketId, { messageId: args.messageId });
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

// Public-facing or admin — append assets to a ticket.
export const addAssets = mutation({
  args: {
    ticketNumber: v.number(),
    assets:       v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_number", (q) => q.eq("ticketNumber", args.ticketNumber))
      .first();
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "closed") throw new Error("Ticket is closed");

    const currentAssets = ticket.assets ?? [];
    const newAssets = Array.from(new Set([...currentAssets, ...args.assets]));

    await ctx.db.patch(ticket._id, {
      assets: newAssets,
      updatedAt: Date.now(),
    });
  },
});
