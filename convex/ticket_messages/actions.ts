"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import nodemailer from "nodemailer";

// Sends a support message and emails info@northbyte.studio with the ticket context.
export const sendWithNotification = action({
  args: {
    ticketId: v.id("tickets"),
    body:     v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Insert message + update waitingOn via mutation
    await ctx.runMutation(api.ticket_messages.mutations.send, {
      ticketId: args.ticketId,
      body:     args.body,
    });

    // 2. Fetch ticket + app for email context
    const ticket = await ctx.runQuery(api.tickets.queries.getById, {
      ticketId: args.ticketId,
    });
    if (!ticket || !ticket.email) return;

    // Backfill messageId for old tickets that don't have one yet
    const messageId = ticket.messageId ?? `<ticket-${ticket.ticketNumber}@northbyte.studio>`;
    if (!ticket.messageId) {
      await ctx.runMutation(api.tickets.mutations.setMessageId, {
        ticketId: args.ticketId,
        messageId,
      });
    }

    // 3. Send notification email to the user who filed the ticket
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    if (!emailUser || !emailPass) return;

    try {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: emailUser, pass: emailPass },
      });

      await transporter.sendMail({
        from:      emailUser,
        to:        ticket.email,
        messageId,
        headers: {
          "In-Reply-To": messageId,
          "References":  messageId,
        },
        subject: `${ticket.appName} - Support [Ticket #${ticket.ticketNumber}]`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
              Neue Support-Nachricht
            </h2>
            <div style="margin: 20px 0;">
              <h4 style="color: #555; margin-bottom: 5px;">Ticket:</h4>
              <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
                #${ticket.ticketNumber} — ${ticket.title}
              </p>
            </div>
            <div style="margin: 20px 0;">
              <h4 style="color: #555; margin-bottom: 5px;">App:</h4>
              <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${ticket.appName}</p>
            </div>
            <div style="margin: 20px 0;">
              <h4 style="color: #555; margin-bottom: 5px;">Nachricht:</h4>
              <div style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${args.body}</div>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
              <p>Gesendet über das NorthByte Studio Support-Dashboard.</p>
            </div>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send support message email:", err);
      // Non-fatal — message is already saved
    }
  },
});
