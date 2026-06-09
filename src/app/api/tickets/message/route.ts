import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, message, assets } = body as {
      ticketId: string;
      message:  string;
      assets?:  string[];
    };

    if (!ticketId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: ticketId, message" },
        { status: 400 }
      );
    }

    await convex.mutation(api.ticket_messages.mutations.sendFromUser, {
      ticketId: ticketId as Id<"tickets">,
      body:     message,
      assets,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";

    if (message === "Ticket not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Unauthorized" || message === "Ticket is closed") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    console.error("Error sending ticket message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
