import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

// Notify subscribers when a feature status changes
export const notifySubscribers = action({
    args: {
        featureId: v.id("features"),
        newStatus: v.string(),
    },
    handler: async (ctx, args) => {
        // Get feature details
        const feature = await ctx.runQuery(api.features.queries.getById, {
            featureId: args.featureId
        });

        if (!feature) throw new Error("Feature not found");

        // Get all subscribers
        const subscribers: Doc<"featureSubscribers">[] = await ctx.runQuery(
            api.features.queries.getSubscribers,
            { featureId: args.featureId }
        );

        // Send emails to all subscribers
        const emailPromises = subscribers.map(async (subscriber) => {
            // Here you would integrate with your email service (e.g., Resend, SendGrid)
            // For now, we'll just log it
            console.log(`Sending email to ${subscriber.email} about feature status change`);
            console.log(`Feature: ${feature.title}`);
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
            //     subject: `Feature Update: ${feature.title}`,
            //     html: `<p>The feature "${feature.title}" has been updated to status: ${args.newStatus}</p>`,
            //   }),
            // });
        });

        await Promise.all(emailPromises);

        return { notified: subscribers.length };
    },
});
