"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { keevioTermsOfUse } from "@/lib/privacy-policies/keevio-terms";
import { memolibTermsOfUse } from "@/lib/privacy-policies/memolib-terms";
import { generalTermsOfUse } from "@/lib/privacy-policies/general-terms";
import { useEffect, useState } from "react";

interface PageProps {
    params: Promise<{ app: string }>;
}

export default function TermsDetail({ params }: PageProps) {
    const [appSlug, setAppSlug] = useState<string | null>(null);
    
    useEffect(() => {
        params.then((p) => setAppSlug(p.app));
    }, [params]);

    const appData = useQuery(
        api.apps.queries.getBySlug,
        appSlug && appSlug !== "general" ? { slug: appSlug } : "skip"
    );

    const isGeneral = appSlug === "general";
    const title = isGeneral ? "NorthByte Studio Website" : appData?.name || appSlug;
    const isKeevio = appSlug === "keevio";
    const isMemoLib = appSlug === "memolib";

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20">
                <div className="mb-8">
                    <Link href="/terms-of-use" className="text-sm text-accent hover:underline">← Back to Overview</Link>
                </div>

                {isKeevio ? (
                    <article
                        className="prose prose-invert prose-lg max-w-3xl"
                        dangerouslySetInnerHTML={{ __html: keevioTermsOfUse }}
                    />
                ) : isMemoLib ? (
                    <article
                        className="prose prose-invert prose-lg max-w-3xl"
                        dangerouslySetInnerHTML={{ __html: memolibTermsOfUse }}
                    />
                ) : isGeneral ? (
                    <article
                        className="prose prose-invert prose-lg max-w-3xl"
                        dangerouslySetInnerHTML={{ __html: generalTermsOfUse }}
                    />
                ) : (
                    <article className="prose prose-invert prose-lg max-w-3xl">
                        <h1>Terms of Use for {title}</h1>
                        <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>

                        <h2>1. Scope</h2>
                        <p>These terms apply to the usage of {title}. By using our services, you agree to these terms.</p>

                        <h2>2. Usage Rules</h2>
                        <p>You agree not to misuse the service or attempt to access it using unauthorized methods.</p>

                        <h2>3. Subscriptions</h2>
                        <p>If the app offers paid subscriptions, they are billed in advance on a recurring basis.</p>

                        <h2>4. Termination</h2>
                        <p>We reserve the right to terminate or suspend access to our service immediately, without prior notice.</p>

                        <h2>5. Liability</h2>
                        <p>NorthByte Studio shall not be held liable for indirect, incidental, or consequential damages.</p>

                        <h2>6. Governing Law</h2>
                        <p>These terms shall be governed by the laws of the jurisdiction in which NorthByte Studio operates.</p>
                    </article>
                )}
            </main>
            <Footer />
        </div>
    );
}
