import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { keevioPrivacyPolicy } from "@/lib/privacy-policies/keevio";
import { memolibPrivacyPolicy } from "@/lib/privacy-policies/memolib";
import { generalPrivacyPolicy } from "@/lib/privacy-policies/general";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

interface PageProps {
    params: Promise<{ app: string }>;
}

const articleClass = "prose prose-invert prose-lg max-w-3xl prose-headings:text-primary prose-p:text-secondary prose-strong:text-primary prose-a:text-accent prose-hr:border-border prose-li:text-secondary";

export default async function PrivacyPolicyDetail({ params }: PageProps) {
    const { app: appSlug } = await params;

    const appData = await fetchQuery(api.apps.queries.getBySlug, { slug: appSlug }).catch(() => null);

    const isGeneral = appSlug === "general";
    const title = isGeneral ? "NorthByte Studio Website" : appData?.name || appSlug;
    const isKeevio = appSlug === "keevio";
    const isMemoLib = appSlug === "memolib";

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20">
                <div className="mb-8">
                    <Link href="/privacy-policy" className="text-sm text-accent hover:underline">← Back to Overview</Link>
                </div>

                {appData?.privacyPolicy ? (
                    <article className={articleClass}>
                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                            {appData.privacyPolicy}
                        </ReactMarkdown>
                    </article>
                ) : isKeevio ? (
                    <article
                        className={articleClass}
                        dangerouslySetInnerHTML={{ __html: keevioPrivacyPolicy }}
                    />
                ) : isMemoLib ? (
                    <article
                        className={articleClass}
                        dangerouslySetInnerHTML={{ __html: memolibPrivacyPolicy }}
                    />
                ) : isGeneral ? (
                    <article
                        className={articleClass}
                        dangerouslySetInnerHTML={{ __html: generalPrivacyPolicy }}
                    />
                ) : (
                    <article className={articleClass}>
                        <h1>Privacy Policy for {title}</h1>
                        <p className="lead">Last updated: {new Date().toLocaleDateString()}</p>

                        <h2>1. Responsible Entity</h2>
                        <p>NorthByte Studio is responsible for the data processing on this {isGeneral ? "website" : "application"}.</p>

                        <h2>2. Data Collection</h2>
                        <p>We collect minimal data necessary to provide our services. {isGeneral ? "For website visitors, this may include IP addresses and standard web logs." : "For app users, this depends on the specific features used."}</p>

                        <h2>3. Analytics</h2>
                        <p>We may use anonymous analytics to improve our products. No personally identifiable information is traded.</p>

                        <h2>4. Third Parties</h2>
                        <p>We do not share data with third parties unless required by law or for core functional services (e.g. hosting).</p>

                        <h2>5. User Rights</h2>
                        <p>You have the right to request information about your stored data at any time.</p>

                        <h2>6. Contact</h2>
                        <p>If you have questions, reach out via our contact form.</p>
                    </article>
                )}
            </main>
            <Footer />
        </div>
    );
}
