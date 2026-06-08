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
