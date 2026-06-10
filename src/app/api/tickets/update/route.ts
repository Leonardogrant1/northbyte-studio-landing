import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketNumber, assets } = body as {
      ticketNumber: number;
      assets?: string[];
    };

    console.log("Ticket number:", ticketNumber);
    console.log("Assets:", assets);

    if (!ticketNumber || !assets || !Array.isArray(assets)) {
      return NextResponse.json(
        { error: "Missing or invalid required fields: ticketNumber, assets (array)" },
        { status: 400 }
      );
    }

    await convex.mutation(api.tickets.mutations.addAssets, {
      ticketNumber,
      assets,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update ticket";

    if (message === "Ticket not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Ticket is closed") {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    console.error("Error updating ticket assets:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}
