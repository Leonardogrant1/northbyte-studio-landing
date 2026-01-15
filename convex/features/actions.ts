"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Doc } from "../_generated/dataModel";
import nodemailer from "nodemailer";

// Notify subscribers when a feature is completed
export const notifySubscribers = action({
    args: {
        featureId: v.id("features"),
        newStatus: v.string(),
    },
    handler: async (ctx, args) => {
        // Only notify if status is "completed"
        if (args.newStatus !== "completed") {
            return { notified: 0 };
        }

        // Get feature details
        const feature = await ctx.runQuery(api.features.queries.getById, {
            featureId: args.featureId
        });

        if (!feature) throw new Error("Feature not found");

        // Get app details
        const app = await ctx.runQuery(api.apps.queries.getById, {
            appId: feature.appId
        });

        // Get all subscribers
        const subscribers: Doc<"featureSubscribers">[] = await ctx.runQuery(
            api.features.queries.getSubscribers,
            { featureId: args.featureId }
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
            const subject = `Feature Completed: ${feature.title}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
                        Feature Completed
                    </h2>
                    
                    <div style="margin: 20px 0;">
                        <p style="color: #555; font-size: 16px;">
                            Great news! The feature request you subscribed to has been completed.
                        </p>
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px;">
                        <h3 style="color: #333; margin-top: 0;">${feature.title}</h3>
                        <p style="color: #666; margin-bottom: 10px;">${feature.description}</p>
                        ${app ? `<p style="color: #888; font-size: 14px; margin: 0;">App: ${app.name}</p>` : ""}
                    </div>
                    
                    <div style="margin: 20px 0; padding: 15px; background-color: #d4edda; border-radius: 5px; border-left: 4px solid #28a745;">
                        <p style="color: #155724; margin: 0; font-weight: bold;">Status: Completed ✓</p>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                        <p>You received this email because you subscribed to updates for this feature request.</p>
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
