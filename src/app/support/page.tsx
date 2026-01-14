import Link from "next/link";
import { supportContent, generalSupport } from "@/lib/support-content";

export default function SupportOverviewPage() {
    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 md:px-6 py-24 max-w-5xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        {generalSupport.title}
                    </h1>
                    <p className="text-xl text-secondary max-w-2xl mx-auto">
                        {generalSupport.description}
                    </p>
                </div>

                {/* Support Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {supportContent.map((content) => (
                        <Link
                            key={content.slug}
                            href={`/support/${content.slug}`}
                            className="group bg-surface border border-border rounded-2xl p-8 hover:border-accent transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <h2 className="text-2xl font-bold mb-3 group-hover:text-accent transition-colors">
                                {content.appName}
                            </h2>
                            <p className="text-secondary mb-4">
                                {content.description}
                            </p>
                            <div className="text-accent font-medium flex items-center gap-2">
                                Support kontaktieren
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* General Contact Info */}
                <div className="bg-surface2 rounded-2xl p-8 border border-border text-center">
                    <h3 className="text-xl font-bold mb-3">Allgemeine Anfragen</h3>
                    <p className="text-secondary mb-4">
                        Für allgemeine Fragen oder wenn Sie nicht sicher sind, welche App Sie betrifft,
                        können Sie uns auch über unser{" "}
                        <Link href="/contact" className="text-accent hover:underline">
                            Kontaktformular
                        </Link>{" "}
                        erreichen.
                    </p>
                </div>
            </div>
        </main>
    );
}
