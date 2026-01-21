"use client";

import { Suspense, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SupportForm } from "@/components/forms/SupportForm";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default function SupportPage({ params }: PageProps) {
    const [slug, setSlug] = useState<string | null>(null);
    
    useEffect(() => {
        params.then((p) => setSlug(p.slug));
    }, [params]);

    const appData = useQuery(
        api.apps.queries.getBySlugForPublic,
        slug ? { slug } : "skip"
    );

    if (slug && appData === null) {
        notFound();
    }

    if (!appData) {
        return (
            <main className="min-h-screen bg-background">
                <div className="container mx-auto px-4 md:px-6 py-24 max-w-4xl">
                    <div className="h-[400px] bg-surface2 animate-pulse rounded-3xl" />
                </div>
            </main>
        );
    }

    const title = `${appData.name} Support`;
    const description = appData.description || `Need help with ${appData.name}? We're here to help. Whether you have questions about usage, want to report technical issues, or provide feedback – feel free to contact us.`;
    const contactPrompt = `Describe your request and we'll get back to you as soon as possible.`;

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 md:px-6 py-24 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-16">
                    {appData.logoUrl && (
                        <div className="flex justify-center mb-6">
                            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-surface2 border border-border flex items-center justify-center">
                                <Image
                                    src={appData.logoUrl}
                                    alt={`${appData.name} logo`}
                                    fill
                                    className="object-contain p-2"
                                />
                            </div>
                        </div>
                    )}
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        {title}
                    </h1>
                    <p className="text-xl text-secondary max-w-2xl mx-auto">
                        {description}
                    </p>
                </div>

                {/* Support Form Section */}
                <div className="bg-surface rounded-3xl p-8 md:p-12 border border-border">
                    <h2 className="text-2xl font-bold mb-2">{contactPrompt}</h2>
                    <p className="text-secondary mb-8">
                        Fill out the form and we'll get back to you as soon as possible.
                    </p>

                    <Suspense fallback={<div className="h-[400px] bg-surface2 animate-pulse rounded-3xl" />}>
                        <SupportForm appSlug={appData.slug} appName={appData.name} />
                    </Suspense>
                </div>

                {/* Back Link */}
                <div className="mt-12 text-center">
                    <Link
                        href="/support"
                        className="text-secondary hover:text-accent transition-colors underline"
                    >
                        ← Back to Support Overview
                    </Link>
                </div>
            </div>
        </main>
    );
}
