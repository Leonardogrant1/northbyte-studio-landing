export interface Content {
    id: string;
    "Title": string;
    "Unedited Media": string;
    "Postiz PostID": string;
    "Schedule Date": string;
    "Media": string;
    "Status": string;
    "Platform": string;
    "Description": string;
    "Created At": string;
    "Updated At": string;
}

export interface Creator {
    id: string;
    "name": string;
    "image"?: { url: string }[];
    "age"?: number;
    "biography"?: string;
    "password"?: string;
    "Accounts"?: string[]; // Array of Account IDs
    "Language"?: string;
    "Film Locations"?: string[];
    "Weather Code"?: string;
}

export interface SocialMediaAccount {
    id: string;
    "Platform": string;
    "Username": string;
    "Creator"?: string[]; // Array of Creator IDs
}

export interface SchedulePostPayload {
    creatorId: string;
    videoUrl: string;
    title: string;
    description: string;
    hashtags: string[];
    selectedAccounts: string[]; // Array of Account IDs
    topicType: string;
}