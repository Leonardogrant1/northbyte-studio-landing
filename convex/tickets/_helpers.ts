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
