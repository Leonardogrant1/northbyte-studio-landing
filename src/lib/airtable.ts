import Airtable from "airtable";
import { Content } from "@/types";

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
