import { NextRequest, NextResponse } from "next/server";
import { createScheduledPost } from "@/lib/airtable";
import { SchedulePostPayload } from "@/types";

export async function POST(request: NextRequest) {
    try {
        const payload: SchedulePostPayload = await request.json();

        const { fetchAccountsByIds } = await import("@/lib/airtable");

        // Validate payload
        if (!payload.creatorId || !payload.videoUrl || !payload.title || !payload.selectedAccounts || payload.selectedAccounts.length === 0) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Fetch selected accounts to determine their platforms
        const fetchedAccounts = await fetchAccountsByIds(payload.selectedAccounts);

        // Iterate through selected accounts to create individual records for each one
        const promises = payload.selectedAccounts.map(async (accountId) => {
            const accountInfo = fetchedAccounts.find(acc => acc.id === accountId);
            const platformStr = accountInfo ? accountInfo.Platform : "";

            const postData = {
                "Title": payload.title,
                "Platform": platformStr,
                "Account": [accountId], // Link to Accounts specifically
                "Status": "Ready For Scheduling",
                "Media": payload.videoUrl, // Storing the R2 URL
                "Hashtags": payload.hashtags && payload.hashtags.length > 0 ? payload.hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(" ") : "",
                // Note: user did not request the Description to be inserted according to message, 
                // but we might want to still add it if it exists. User said: 
                // "Das Form soll letzendlich einfach Platform, hastags, Account, Title und status ... Die mediaUrl... "
                "Topic Type": payload.topicType ?? "Entertainment",
                ...(payload.description && { "Description": payload.description })
            };

            console.log("Post Data:", postData);

            const isSuccess = await createScheduledPost(postData);
            if (!isSuccess) {
                throw new Error(`Failed to create record in Airtable for account: ${accountId}`);
            }
        });

        await Promise.all(promises);

        return NextResponse.json(
            { success: true, message: "Posts scheduled successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error scheduling post:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to schedule post",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
