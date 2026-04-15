import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, appSlug, title, description } = body;

    // Validate required fields
    if (!userId || !appSlug || !title || !description) {
      return NextResponse.json(
        { error: "Missing required fields: userId, appSlug, title, description" },
        { status: 400 }
      );
    }

    // Create transporter with Gmail SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "info@northbyte.studio",
      subject: `[Ticket] ${appSlug}: ${title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            New Ticket Created
          </h2>

          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">User ID:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              ${userId}
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">App:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              ${appSlug}
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Title:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              ${title}
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Description:</h4>
            <div style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">
              ${description}
            </div>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
            <p>This ticket was submitted via the Northbyte Studio API.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: "Ticket created and email sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 }
    );
  }
}
