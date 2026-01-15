"use node";
import { action } from "../_generated/server.js";
import { v } from "convex/values";
import { api } from "../_generated/api.js";
import { Id, Doc } from "../_generated/dataModel.js";
import nodemailer from "nodemailer";

// Notify subscribers when a bug is resolved
export const notifySubscribers = action({
    args: {
        bugId: v.id("bugs"),
        newStatus: v.string(),
    },
    handler: async (ctx, args) => {
        // Only notify if status is "resolved"
        if (args.newStatus !== "resolved") {
            return { notified: 0 };
        }

        // Get bug details
        const bug = await ctx.runQuery(api.bugs.queries.getById, {
            bugId: args.bugId
        });

        if (!bug) throw new Error("Bug not found");

        // Get app details
        const app = await ctx.runQuery(api.apps.queries.getById, {
            appId: bug.appId
        });

        // Get all subscribers
        const subscribers: Doc<"bugSubscribers">[] = await ctx.runQuery(
            api.bugs.queries.getSubscribers,
            { bugId: args.bugId }
        );

        if (subscribers.length === 0) {
            return { notified: 0 };
        }

        // Create transporter with Gmail SMTP
        const emailUser = process.env.EMAIL_USER;
        const emailPass = process.env.EMAIL_PASS;

        if (!emailUser || !emailPass) {
            console.error("EMAIL_USER or EMAIL_PASS environment variables are not set in Convex");
            return { notified: 0 };
        }

        // Extract local part from email (part before @)
        const emailLocalPart = emailUser.split("@")[0];
        // Use app domain if available, otherwise use original email domain
        const fromEmail = app?.domain 
            ? `${emailLocalPart}@${app.domain}`
            : emailUser;

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: emailUser,
                pass: emailPass,
            },
        });

        // Send emails to all subscribers
        const emailPromises = subscribers.map(async (subscriber) => {
            const subject = `Bug Resolved: ${bug.title}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
                        Bug Resolved
                    </h2>
                    
                    <div style="margin: 20px 0;">
                        <p style="color: #555; font-size: 16px;">
                            Great news! The bug you subscribed to has been resolved.
                        </p>
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                        <h3 style="color: #333; margin-top: 0;">${bug.title}</h3>
                        <p style="color: #666; margin-bottom: 10px;">${bug.description}</p>
                        ${app ? `<p style="color: #888; font-size: 14px; margin: 0;">App: ${app.name}</p>` : ""}
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #d4edda; border-radius: 5px; border-left: 4px solid #28a745;">
                        <p style="color: #155724; margin: 0; font-weight: bold;">Status: Resolved ✓</p>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                        <p>You received this email because you subscribed to updates for this bug.</p>
                    </div>
                </div>
            `;

            try {
                await transporter.sendMail({
                    from: fromEmail,
                    to: subscriber.email,
                    subject: subject,
                    html: html,
                });
            } catch (error) {
                console.error(`Error sending email to ${subscriber.email}:`, error);
            }
        });

        await Promise.all(emailPromises);

        return { notified: subscribers.length };
    },
});
