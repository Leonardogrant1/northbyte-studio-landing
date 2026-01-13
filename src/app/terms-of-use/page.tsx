import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { apps } from "@/lib/apps";

export default function TermsOverview() {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20">
                <h1 className="text-4xl md:text-5xl font-bold mb-8">Terms of Use</h1>
                <p className="text-xl text-secondary mb-12 max-w-2xl">
                    Please select an application to view its specific Terms of Use.
                </p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="/terms-of-use/general" className="block p-6 bg-surface border border-border rounded-xl hover:border-accent hover:bg-surface2 transition-all">
                        <h2 className="text-xl font-bold mb-2">General / Website</h2>
                        <p className="text-sm text-secondary">Terms for northbytestudio.com</p>
                    </Link>
                    {apps.map(app => (
                        <Link key={app.slug} href={`/terms-of-use/${app.slug}`} className="block p-6 bg-surface border border-border rounded-xl hover:border-accent hover:bg-surface2 transition-all">
                            <h2 className="text-xl font-bold mb-2">{app.name}</h2>
                            <p className="text-sm text-secondary">Terms for {app.name}</p>
                        </Link>
                    ))}
                </div>
            </main>
            <Footer />
        </div>
    );
}
