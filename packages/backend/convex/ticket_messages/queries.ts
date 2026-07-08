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
        if (m.externalAuthorId) {
          return { ...m, authorName: "User" };
        }
        const author = m.authorId ? await ctx.db.get(m.authorId) : null;
        const authorName = [author?.name, author?.lastName].filter(Boolean).join(" ") || author?.email || "Support";
        return { ...m, authorName };
      })
    );
  },
});
