import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";

interface PostizMedia {
  id: string;
  path: string;
}

interface PostPayload {
  integrationId: string;
  postizMedia: PostizMedia[];
  content: string;
  settings: Record<string, unknown>;
  scheduledAt?: string; // ISO string; if omitted → post now
}

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
    const { integrationId, postizMedia, content, settings, scheduledAt } = body as PostPayload;

    if (!integrationId || typeof integrationId !== "string") {
      return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    if (!Array.isArray(postizMedia)) {
      return NextResponse.json({ error: "postizMedia must be an array" }, { status: 400 });
    }

    const postizPayload = {
      type: scheduledAt ? "schedule" : "now",
      date: scheduledAt ?? new Date().toISOString(),
      shortLink: false,
      tags: [],
      posts: [
        {
          integration: { id: integrationId },
          value: [
            {
              content,
              image: postizMedia.map(({ id, path }) => ({ id, path })),
            },
          ],
          settings: settings ?? {},
        },
      ],
    };

    const postizResponse = await fetch(`${baseUrl}/posts`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postizPayload),
    });

    if (!postizResponse.ok) {
      const errorText = await postizResponse.text();
      console.error("Postiz posts error:", postizResponse.status, errorText);
      return NextResponse.json(
        { error: errorText },
        { status: postizResponse.status }
      );
    }

    const data = await postizResponse.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Error proxying post to Postiz:", error);
    return NextResponse.json({ error: "Failed to create post on Postiz" }, { status: 500 });
  }
}
