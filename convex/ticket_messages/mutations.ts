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
