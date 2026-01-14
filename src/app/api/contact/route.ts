import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { name, email, message, app, type } = await request.json();

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Determine subject based on type and app selection
    const isSupport = type === "support";
    let subject = isSupport ? "Neue Support Anfrage!" : "Neue Kontakt Anfrage!";

    if (app) {
      const appNames: { [key: string]: string } = {
        memolib: "MemoLib",
        keevio: "Keevio",
      };
      const appName = appNames[app] || app;
      subject = isSupport
        ? `Support Anfrage - ${appName}`
        : `Neue Kontakt Anfrage - ${appName}`;
    }

    // Send email
    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_TO,
      replyTo: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
            ${isSupport ? "Neue Support Anfrage" : "Neue Kontakt Anfrage"}
          </h2>
          
          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Name:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              ${name}
            </p>
          </div>
          
          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Email:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              <a href="mailto:${email}" style="color: #4F46E5; text-decoration: none;">
                ${email}
              </a>
            </p>
          </div>
          
          ${app
          ? `
          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Interessiert an App:</h4>
            <p style="margin: 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              ${app}
            </p>
          </div>
          `
          : ""
        }
          
          <div style="margin: 20px 0;">
            <h4 style="color: #555; margin-bottom: 5px;">Nachricht:</h4>
            <div style="margin: 0; padding: 15px; background-color: #f5f5f5; border-radius: 5px; white-space: pre-wrap;">
              ${message}
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
            <p>Diese Nachricht wurde über das ${isSupport ? "Support-Formular" : "Kontaktformular"} auf northbyte.studio gesendet.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(
      { success: true, message: "Email sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
