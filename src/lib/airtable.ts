import Airtable from "airtable";
import { Content, Creator, SocialMediaAccount } from "@/types";

// Initialize Airtable
const getAirtableBase = () => {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
        throw new Error("Airtable credentials not configured");
    }

    Airtable.configure({
        apiKey: apiKey,
    });

    return Airtable.base(baseId);
};

/**
 * Fetch all contents from Airtable Contents table
 */
export async function fetchContents(): Promise<Content[]> {
    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Contents";

        const records = await base(tableName)
            .select({
                // You can add filtering here if needed
                filterByFormula: "{Status} = 'Needs Approval'",
                sort: [{ field: "Created At", direction: "desc" }],
            })
            .all();

        return records.map((record) => ({
            id: record.id,
            "Title": record.get("Title") as string || "Untitled",
            "Unedited Media": record.get("Unedited Media") as string || "",
            "Postiz PostID": record.get("Postiz PostID") as string || "",
            "Schedule Date": record.get("Schedule Date") as string || "",
            "Media": record.get("Media") as string || "",
            "Status": record.get("Status") as string || "",
            "Platform": record.get("Platform") as string || "",
            "Description": record.get("Description") as string || "",
            "Created At": record.get("Created At") as string || "",
            "Updated At": record.get("Updated At") as string || "",
        }));
    } catch (error) {
        console.error("Error fetching from Airtable:", error);
        throw error;
    }
}

/**
 * Get a single content by ID
 */
export async function fetchContentById(id: string): Promise<Content | null> {
    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Contents";

        const record = await base(tableName).find(id);

        return {
            id: record.id,
            "Title": record.get("Title") as string || "Untitled",
            "Unedited Media": record.get("Unedited Media") as string || "",
            "Postiz PostID": record.get("Postiz PostID") as string || "",
            "Schedule Date": record.get("Schedule Date") as string || "",
            "Media": record.get("Media") as string || "",
            "Status": record.get("Status") as string || "",
            "Platform": record.get("Platform") as string || "",
            "Description": record.get("Description") as string || "",
            "Created At": record.get("Created At") as string || "",
            "Updated At": record.get("Updated At") as string || "",
        };
    } catch (error) {
        console.error("Error fetching content by ID:", error);
        return null;
    }
}

/**
 * Update a content record with any fields
 */
export async function updateContent(
    id: string,
    updates: Record<string, string>
): Promise<boolean> {
    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Contents";

        await base(tableName).update(id, updates);

        return true;
    } catch (error) {
        console.error("Error updating content:", error);
        return false;
    }
}

/**
 * Get a single Creator by ID
 */
export async function fetchCreatorById(id: string): Promise<Creator | null> {
    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_CREATORS_TABLE_NAME || "AI UGC Creators";

        const record = await base(tableName).find(id);

        return {
            id: record.id,
            "name": record.get("name") as string || "Unknown Creator",
            "image": record.get("image") as { url: string }[] | undefined,
            "age": record.get("age") as number | undefined,
            "biography": record.get("biography") as string | undefined,
            "password": record.get("password") as string | undefined,
            "Accounts": record.get("Accounts") as string[] | undefined,
            "Language": record.get("Language") as string | undefined,
            "Film Locations": record.get("Film Locations") as string[] | undefined,
            "Weather Code": record.get("Weather Code") as string | undefined,
        };
    } catch (error) {
        console.error("Error fetching creator by ID:", error);
        return null;
    }
}

/**
 * Fetch Social Media Accounts by their Record IDs
 */
export async function fetchAccountsByIds(ids: string[]): Promise<SocialMediaAccount[]> {
    if (!ids || ids.length === 0) return [];

    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_ACCOUNTS_TABLE_NAME || "Accounts";

        // Construct filter formula for OR({Record_ID()}='id1', {Record_ID()}='id2', ...)
        const filterFormula = `OR(${ids.map(id => `RECORD_ID()='${id}'`).join(', ')})`;

        const records = await base(tableName)
            .select({
                filterByFormula: filterFormula
            })
            .all();

        return records.map(record => ({
            id: record.id,
            "Platform": record.get("Platform") as string || "",
            "Username": record.get("Username") as string || "Unknown Username",
        }));
    } catch (error) {
        console.error("Error fetching accounts by IDs:", error);
        return [];
    }
}

/**
 * Create a new Scheduled Post in the Contents table
 */
export async function createScheduledPost(postData: any): Promise<boolean> {
    try {
        const base = getAirtableBase();
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Contents";

        await base(tableName).create([
            {
                fields: postData
            }
        ]);

        return true;
    } catch (error) {
        console.error("Error scheduling post to Airtable:", error);
        return false;
    }
}
