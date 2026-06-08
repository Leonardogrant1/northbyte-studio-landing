import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, appSlug, title, description, email } = body as {
      userId:      string;
      appSlug:     string;
      title:       string;
      description: string;
      email?:      string;
    };

    if (!userId || !appSlug || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: userId, appSlug, title, description" },
        { status: 400 }
      );
    }

    // --- Email (unchanged) ---
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (emailUser && emailPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: emailUser, pass: emailPass },
        });
        await transporter.sendMail({
          from: emailUser,
          to: "info@northbyte.studio",
          subject: `[Ticket] ${appSlug}: ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
                New Ticket Created
              </h2>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">User ID:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${userId}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Email:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${email ?? "—"}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">App:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${appSlug}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Title:</h4>
                <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">${title}</p>
              </div>
              <div style="margin: 20px 0;">
                <h4 style="color: #555; margin-bottom: 5px;">Description:</h4>
                <div style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">${description}</div>
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
                <p>This ticket was submitted via the Northbyte Studio API.</p>
              </div>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send ticket email:", emailErr);
        // Non-fatal — continue to DB insert
      }
    }

    // --- Convex DB insert ---
    // Resolve appSlug → appId
    const app = await convex.query(api.apps.queries.getBySlug, { slug: appSlug });
    if (!app) {
      return NextResponse.json({ error: `App not found: ${appSlug}` }, { status: 400 });
    }

    const { ticketId, ticketNumber } = await convex.mutation(api.tickets.mutations.create, {
      appId:          app._id,
      externalUserId: userId,
      email,
      title,
      description,
    });

    return NextResponse.json(
      { success: true, ticketId, ticketNumber },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}
