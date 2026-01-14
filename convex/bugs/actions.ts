import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";


// Notify subscribers when a bug status changes
export const notifySubscribers = action({
    args: {
        bugId: v.id("bugs"),
        newStatus: v.string(),
    },
    handler: async (ctx, args) => {
        // Get bug details
        const bug = await ctx.runQuery(api.bugs.queries.getById, {
            bugId: args.bugId
        });

        if (!bug) throw new Error("Bug not found");

        // Get all subscribers
        const subscribers: Array<{ email: string; bugId: Id<"bugs"> }> = await ctx.runQuery(
            api.bugs.queries.getSubscribers,
            { bugId: args.bugId }
        );

        // Send emails to all subscribers
        const emailPromises = subscribers.map(async (subscriber: { email: string }) => {
            // Here you would integrate with your email service (e.g., Resend, SendGrid)
            // For now, we'll just log it
            console.log(`Sending email to ${subscriber.email} about bug status change`);
            console.log(`Bug: ${bug.title}`);
            console.log(`New Status: ${args.newStatus}`);

            // Example with fetch to an email API:
            // await fetch("https://api.resend.com/emails", {
            //   method: "POST",
            //   headers: {
            //     "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            //     "Content-Type": "application/json",
            //   },
            //   body: JSON.stringify({
            //     from: "notifications@yourdomain.com",
            //     to: subscriber.email,
            //     subject: `Bug Update: ${bug.title}`,
            //     html: `<p>The bug "${bug.title}" has been updated to status: ${args.newStatus}</p>`,
            //   }),
            // });
        });

        await Promise.all(emailPromises);

        return { notified: subscribers.length };
    },
});
