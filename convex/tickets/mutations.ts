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
