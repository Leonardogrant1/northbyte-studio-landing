import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSupportContentBySlug, getAllSupportSlugs } from "@/lib/support-content";
import { SupportForm } from "@/components/forms/SupportForm";

export async function generateStaticParams() {
    const slugs = getAllSupportSlugs();
    return slugs.map((slug) => ({
        slug: slug,
    }));
}

export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const content = getSupportContentBySlug(slug);

    if (!content) {
        notFound();
    }

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 md:px-6 py-24 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        {content.title}
                    </h1>
                    <p className="text-xl text-secondary max-w-2xl mx-auto">
                        {content.description}
                    </p>
                </div>

                {/* Support Form Section */}
                <div className="bg-surface rounded-3xl p-8 md:p-12 border border-border">
                    <h2 className="text-2xl font-bold mb-2">{content.contactPrompt}</h2>
                    <p className="text-secondary mb-8">
                        Füllen Sie das Formular aus und wir melden uns schnellstmöglich bei Ihnen.
                    </p>

                    <Suspense fallback={<div className="h-[400px] bg-surface2 animate-pulse rounded-3xl" />}>
                        <SupportForm appSlug={content.slug} appName={content.appName} />
                    </Suspense>
                </div>

                {/* Back Link */}
                <div className="mt-12 text-center">
                    <a
                        href="/support"
                        className="text-secondary hover:text-accent transition-colors underline"
                    >
                        ← Zurück zur Support-Übersicht
                    </a>
                </div>
            </div>
        </main>
    );
}
