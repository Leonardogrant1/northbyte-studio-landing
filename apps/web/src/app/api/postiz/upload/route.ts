import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const clerkUserId = await getAuthenticatedUserId();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.POSTIZ_API_KEY;
  if (!apiKey) {
    console.error("POSTIZ_API_KEY is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const baseUrl = process.env.POSTIZ_BASE_URL ?? "https://api.postiz.com/public/v1";

  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    console.log("URL", url);

    const postizResponse = await fetch(`${baseUrl}/upload-from-url`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!postizResponse.ok) {
      const errorText = await postizResponse.text();
      console.error("Postiz upload error:", postizResponse.status, errorText);
      return NextResponse.json(
        { error: errorText },
        { status: postizResponse.status }
      );
    }

    const data = await postizResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error proxying upload to Postiz:", error);
    return NextResponse.json({ error: "Failed to upload to Postiz" }, { status: 500 });
  }
}
