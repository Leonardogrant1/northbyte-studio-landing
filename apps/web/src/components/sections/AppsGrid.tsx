"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { ArrowRight } from "lucide-react";

export function AppsGrid() {
    const apps = useQuery(api.apps.queries.getAllForPublic) || [];

    return (
        <section id="apps" className="py-24 bg-surface/30">
            <div className="container mx-auto px-4 md:px-6">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold mb-16 text-center"
                >
                    Apps by NorthByte Studio
                </motion.h2>

                {apps.length === 0 ? (
                    <div className="text-center text-secondary py-12">
                        <p>No apps available at the moment.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {apps.map((app, index) => (
                            <motion.div
                                key={app._id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="bg-surface border border-border rounded-3xl overflow-hidden flex flex-col hover:border-accent/30 transition-colors group"
                            >
                                {/* Thumbnail Image */}
                                <div className="relative w-full h-48 bg-surface2 overflow-hidden">
                                    {app.thumbnailUrl ? (
                                        <Image
                                            src={app.thumbnailUrl}
                                            alt={`${app.name} thumbnail`}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <svg className="w-16 h-16 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 flex flex-col flex-1">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-surface2 border border-border flex items-center justify-center">
                                                {app.logoUrl ? (
                                                    <Image
                                                        src={app.logoUrl}
                                                        alt={`${app.name} logo`}
                                                        fill
                                                        className="object-contain"
                                                    />
                                                ) : (
                                                    <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                )}
                                            </div>
                                            <h3 className="text-2xl font-bold group-hover:text-accent transition-colors">{app.name}</h3>
                                        </div>
                                        <span className="px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-full bg-surface2 text-accent border border-accent/20 animate-pulse">
                                            {app.status}
                                        </span>
                                    </div>
                                    <p className="text-lg text-primary mb-4 font-medium">{app.tagline}</p>
                                    <p className="text-secondary text-sm mb-8 line-clamp-3">{app.description}</p>

                                    <div className="mt-auto flex gap-4 pt-6 border-t border-border/50">
                                        {/* In a real app, Learn More might be a modal or dedicated page */}
                                        <button className="text-sm font-semibold hover:text-accent transition-colors">
                                            Learn more
                                        </button>
                                        <Link
                                            href={`/contact?app=${app.slug}`}
                                            className="ml-auto flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-blue transition-colors group-hover:gap-3"
                                        >
                                            Contact about this <ArrowRight className="w-4 h-4" />
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
