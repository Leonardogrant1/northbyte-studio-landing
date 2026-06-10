import { NextRequest, NextResponse } from "next/server";
import { generatePresignedDownloadUrl, R2_BUCKETS } from "@/lib/r2";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const clerkUserId = await getAuthenticatedUserId();
  if (!clerkUserId) {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey || apiKey !== process.env.NORTHBYTE_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  try {
    const fileName = key.split("/").pop();
    const downloadUrl = await generatePresignedDownloadUrl(
      R2_BUCKETS.support,
      key,
      300,
      fileName
    );

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Error generating download URL:", error);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
