import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generatePresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { getAuthenticatedUserId } from "@/lib/auth";
import { R2_BUCKETS } from "@/lib/r2-constants";
import { isCurrentUserAdmin } from "@/lib/is-admin";



const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const VALID_BUCKETS = new Set<string>(Object.values(R2_BUCKETS));

export async function POST(request: NextRequest) {
  const clerkUserId = await getAuthenticatedUserId();
  let viaApiKey = false;
  if (!clerkUserId) {
    const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey || apiKey !== process.env.NORTHBYTE_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    viaApiKey = true;
  }

  try {
    const body = await request.json();
    const { bucket, fileName, fileType, key: customKey } = body as {
      bucket?: string;
      fileName?: string;
      fileType?: string;
      key?: string;
    };

    if (!bucket || !VALID_BUCKETS.has(bucket)) {
      return NextResponse.json(
        { error: `bucket must be one of: ${[...VALID_BUCKETS].join(", ")}` },
        { status: 400 }
      );
    }

    // northbyte-media hosts user attachments (contracts) — writes are admin-only.
    // A valid NORTHBYTE_API_KEY (trusted server automation) is also sufficient.
    if (bucket === R2_BUCKETS.northbyte && !viaApiKey) {
      if (!(await isCurrentUserAdmin())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    if (!fileType || typeof fileType !== "string") {
      return NextResponse.json({ error: "fileType is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const r2Bucket = bucket as R2_BUCKETS;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = customKey ?? `${randomUUID()}_${safeName}`;
    const uploadUrl = await generatePresignedUploadUrl(r2Bucket, key, 600, fileType);
    const downloadUrl = getPublicUrl(r2Bucket, key);

    return NextResponse.json({ uploadUrl, key, downloadUrl }, { status: 200 });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
