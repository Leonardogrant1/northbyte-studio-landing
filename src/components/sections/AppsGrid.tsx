"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { apps } from "@/lib/apps";
import { ArrowRight } from "lucide-react";

export function AppsGrid() {
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {apps.map((app, index) => (
                        <motion.div
                            key={app.slug}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="bg-surface border border-border rounded-3xl overflow-hidden flex flex-col hover:border-accent/30 transition-colors group"
                        >
                            {/* Thumbnail Image */}
                            {app.thumbnail && (
                                <div className="relative w-full h-48 bg-surface2 overflow-hidden">
                                    <Image
                                        src={app.thumbnail}
                                        alt={`${app.name} thumbnail`}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                </div>
                            )}

                            <div className="p-8 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-bold group-hover:text-accent transition-colors">{app.name}</h3>
                                    <span className="px-3 py-1 text-xs font-medium uppercase tracking-wider rounded-full bg-surface2 text-accent border border-accent/20 animate-pulse">
                                        {app.status}
                                    </span>
                                </div>
                                <p className="text-lg text-primary mb-4 font-medium">{app.oneLiner}</p>
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
            </div>
        </section>
    );
}
