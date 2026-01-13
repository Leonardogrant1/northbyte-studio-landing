export interface AppData {
    name: string;
    slug: string;
    oneLiner: string;
    status: "Live" | "Coming Soon" | "Beta";
    description?: string;
    thumbnail?: string; // Path to thumbnail image in /public folder
}

export const apps: AppData[] = [
    {
        name: "MemoLib",
        slug: "memolib",
        oneLiner: "Turn sources into playlists. Learn by listening.",
        status: "Live",
        description: "The ultimate tool for auditory learners. Convert articles, PDFs, and notes into high-quality audio playlists.",
        thumbnail: "/thumbnails/memolib.png" // You can replace this with your image
    },
    {
        name: "Keevio",
        slug: "keevio",
        oneLiner: "Your personal password manager.",
        status: "Coming Soon",
        description: "Secure and simple password management. Keep all your credentials safe and accessible across all your devices.",
        thumbnail: "/thumbnails/keevio.png" // You can replace this with your image
    }
];
