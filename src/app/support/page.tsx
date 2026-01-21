"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function SupportOverviewPage() {
    const apps = useQuery(api.apps.queries.getAllForPublic) || [];

    return (
        <main className="min-h-screen bg-background">
            <div className="container mx-auto px-4 md:px-6 py-24 max-w-5xl">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">
                        Support
                    </h1>
                    <p className="text-xl text-secondary max-w-2xl mx-auto">
                        Welcome to NorthByte Studio Support. Select one of our apps or contact us for general inquiries. We'd love to hear from you!
                    </p>
                </div>

                {/* Support Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {apps.map((app) => (
                        <Link
                            key={app._id}
                            href={`/support/${app.slug}`}
                            className="group bg-surface border border-border rounded-2xl p-8 hover:border-accent transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                {app.logoUrl && (
                                    <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 border border-border flex items-center justify-center">
                                        <Image
                                            src={app.logoUrl}
                                            alt={`${app.name} logo`}
                                            fill
                                            className="object-contain p-1"
                                        />
                                    </div>
                                )}
                                <h2 className="text-2xl font-bold group-hover:text-accent transition-colors">
                                    {app.name}
                                </h2>
                            </div>
                            <p className="text-secondary mb-4">
                                {app.description || `Need help with ${app.name}? We're here to help.`}
                            </p>
                            <div className="text-accent font-medium flex items-center gap-2">
                                Contact Support
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* General Contact Info */}
                <div className="bg-surface2 rounded-2xl p-8 border border-border text-center">
                    <h3 className="text-xl font-bold mb-3">General Inquiries</h3>
                    <p className="text-secondary mb-4">
                        For general questions or if you're not sure which app applies to you,
                        you can also reach us through our{" "}
                        <Link href="/contact" className="text-accent hover:underline">
                            contact form
                        </Link>.
                    </p>
                </div>
            </div>
        </main>
    );
}
