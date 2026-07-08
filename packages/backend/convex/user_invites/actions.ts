"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

export const createAndSend = action({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("creator"), v.literal("affiliate"), v.literal("support")),
    affiliateCode: v.optional(v.string()),
    commissionType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    commissionAmount: v.optional(v.number()),
    appIds: v.optional(v.array(v.id("apps"))),
  },
  handler: async (ctx, args): Promise<{ inviteId: Id<"user_invites">; emailSent: boolean }> => {
    const token = randomUUID();

    // Delegate auth + duplicate check + DB insert to the existing mutation
    const inviteId = (await ctx.runMutation(api.user_invites.mutations.create, {
      email: args.email,
      role: args.role,
      token,
      affiliateCode: args.affiliateCode,
      commissionType: args.commissionType,
      commissionAmount: args.commissionAmount,
      appIds: args.appIds,
    })) as Id<"user_invites">;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const appUrl = process.env.APP_URL ?? "https://northbyte.studio";

    if (!emailUser || !emailPass) {
      console.error("EMAIL_USER or EMAIL_PASS not set in Convex environment.");
      return { inviteId, emailSent: false };
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    const magicLink = `${appUrl}/admin/signup?token=${token}`;
    const roleLabel = args.role === "admin" ? "Admin" : args.role === "affiliate" ? "Affiliate" : args.role === "support" ? "Support" : "Creator";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f0f0f; color: #e0e0e0; padding: 40px 32px; border-radius: 12px;">

        <div style="margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 4px 0;">NorthByte Studio</h1>
          <p style="color: #888; font-size: 14px; margin: 0;">Dashboard Einladung</p>
        </div>

        <h2 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 16px 0;">
          Du wurdest eingeladen
        </h2>

        <p style="color: #b0b0b0; font-size: 15px; line-height: 1.6; margin: 0 0 12px 0;">
          Du hast eine Einladung für das <strong style="color: #ffffff;">NorthByte Studio Dashboard</strong> erhalten.
          Deine zugewiesene Rolle ist <strong style="color: #ffffff;">${roleLabel}</strong>.
        </p>

        <p style="color: #b0b0b0; font-size: 15px; line-height: 1.6; margin: 0 0 32px 0;">
          Klicke auf den Button unten, um dein Konto zu erstellen. Der Link ist einmalig verwendbar.
        </p>

        <a href="${magicLink}"
           style="display: inline-block; background-color: #ffffff; color: #0f0f0f; font-weight: 700;
                  font-size: 15px; padding: 14px 28px; border-radius: 8px; text-decoration: none;">
          Konto erstellen &rarr;
        </a>

        <p style="color: #555; font-size: 13px; margin: 32px 0 0 0; line-height: 1.5;">
          Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
          <a href="${magicLink}" style="color: #888; word-break: break-all;">${magicLink}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #222; margin: 32px 0;" />

        <p style="color: #444; font-size: 12px; margin: 0;">
          Du erhältst diese E-Mail, weil ein Admin dich in das NorthByte Studio Dashboard eingeladen hat.
          Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail ignorieren.
        </p>

      </div>
    `;

    try {
      await transporter.sendMail({
        from: emailUser,
        to: args.email.toLowerCase(),
        subject: "Du wurdest zu NorthByte Studio eingeladen",
        html,
      });
    } catch (err) {
      console.error("Failed to send invite email:", err);
      return { inviteId, emailSent: false };
    }

    return { inviteId, emailSent: true };
  },
});
