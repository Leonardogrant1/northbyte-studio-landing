import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";

export default async function PrivacyPolicyOverview() {
    const apps = await fetchQuery(api.apps.queries.getAllForPublic);

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20">
                <h1 className="text-4xl md:text-5xl font-bold mb-8">Privacy Policy</h1>
                <p className="text-xl text-secondary mb-12 max-w-2xl">
                    This privacy policy applies to NorthByte Studio and its apps. Select an app below to view its specific policy.
                </p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="/privacy-policy/general" className="block p-6 bg-surface border border-border rounded-xl hover:border-accent hover:bg-surface2 transition-all">
                        <h2 className="text-xl font-bold mb-2">General / Website</h2>
                        <p className="text-sm text-secondary">Policy for northbytestudio.com visitors</p>
                    </Link>
                    {apps.map(app => (
                        <Link key={app._id} href={`/privacy-policy/${app.slug}`} className="block p-6 bg-surface border border-border rounded-xl hover:border-accent hover:bg-surface2 transition-all">
                            <h2 className="text-xl font-bold mb-2">{app.name}</h2>
                            <p className="text-sm text-secondary">Specific policy for {app.name}</p>
                        </Link>
                    ))}
                </div>
            </main>
            <Footer />
        </div>
    );
}
