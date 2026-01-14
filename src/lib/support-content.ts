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
        description: "Benötigen Sie Hilfe mit Keevio? Wir sind hier, um Ihnen zu helfen. Ob Sie Fragen zur Nutzung haben, technische Probleme melden möchten oder Feedback geben wollen – kontaktieren Sie uns gerne.",
        contactPrompt: "Beschreiben Sie Ihr Anliegen und wir melden uns schnellstmöglich bei Ihnen."
    },
    {
        slug: "memolib",
        appName: "MemoLib",
        title: "MemoLib Support",
        description: "Haben Sie Fragen zu MemoLib? Unser Support-Team steht Ihnen zur Verfügung. Egal ob es um die Erstellung von Audio-Playlists, technische Schwierigkeiten oder Feature-Anfragen geht – wir helfen Ihnen gerne weiter.",
        contactPrompt: "Teilen Sie uns mit, wie wir Ihnen helfen können."
    }
];

export const generalSupport: SupportContent = {
    slug: "general",
    appName: "NorthByte Studio",
    title: "Support",
    description: "Willkommen beim NorthByte Studio Support. Wählen Sie eine unserer Apps aus oder kontaktieren Sie uns für allgemeine Anfragen. Wir freuen uns, von Ihnen zu hören!",
    contactPrompt: "Wie können wir Ihnen helfen?"
};

export function getSupportContentBySlug(slug: string): SupportContent | undefined {
    return supportContent.find(content => content.slug === slug);
}

export function getAllSupportSlugs(): string[] {
    return supportContent.map(content => content.slug);
}
