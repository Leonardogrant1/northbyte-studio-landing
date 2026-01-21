export interface SupportContent {
    slug: string;
    appName: string;
    title: string;
    description: string;
    contactPrompt: string;
}

export const supportContent: SupportContent[] = [
    {
        slug: "keevio",
        appName: "Keevio",
        title: "Keevio Support",
        description: "Need help with Keevio? We're here to help. Whether you have questions about usage, want to report technical issues, or provide feedback – feel free to contact us.",
        contactPrompt: "Describe your request and we'll get back to you as soon as possible."
    },
    {
        slug: "memolib",
        appName: "MemoLib",
        title: "MemoLib Support",
        description: "Have questions about MemoLib? Our support team is here for you. Whether it's about creating audio playlists, technical difficulties, or feature requests – we're happy to help.",
        contactPrompt: "Let us know how we can help you."
    }
];

export const generalSupport: SupportContent = {
    slug: "general",
    appName: "NorthByte Studio",
    title: "Support",
    description: "Welcome to NorthByte Studio Support. Select one of our apps or contact us for general inquiries. We'd love to hear from you!",
    contactPrompt: "How can we help you?"
};

export function getSupportContentBySlug(slug: string): SupportContent | undefined {
    return supportContent.find(content => content.slug === slug);
}

export function getAllSupportSlugs(): string[] {
    return supportContent.map(content => content.slug);
}
