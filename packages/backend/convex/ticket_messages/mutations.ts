import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getCallerAndTicket } from "../tickets/_helpers";

// Send a message from a support/admin user. Sets waitingOn to "user" automatically.
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
      ticketId: ticket._id,
      authorId: caller._id,
      body:     args.body,
      createdAt: now,
    });

    // Auto-switch: support replied → waiting on user
    await ctx.db.patch(ticket._id, { waitingOn: "user", updatedAt: now });
  },
});

// Send a message from an external app user (no Convex auth).
// Called from the public /api/tickets/message route.
// Sets waitingOn back to "support" automatically.
export const sendFromUser = mutation({
  args: {
    ticketNumber: v.number(),
    body:         v.string(),
    assets:       v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db
      .query("tickets")
      .withIndex("by_number", (q) => q.eq("ticketNumber", args.ticketNumber))
      .first();
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "closed") throw new Error("Ticket is closed");

    const now = Date.now();
    await ctx.db.insert("ticket_messages", {
      ticketId:         ticket._id,
      externalAuthorId: ticket.externalUserId,
      body:             args.body,
      assets:           args.assets,
      createdAt:        now,
    });

    // Auto-switch: user replied → waiting on support
    await ctx.db.patch(ticket._id, { waitingOn: "support", updatedAt: now });
  },
});
