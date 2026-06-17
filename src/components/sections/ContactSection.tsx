"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";

function ContactFormContent() {
    const searchParams = useSearchParams();
    const [appSlug, setAppSlug] = useState<string>("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    const apps = useQuery(api.apps.queries.getByStatus, { status: "live" }) || [];

    useEffect(() => {
        const slug = searchParams.get("app");
        if (slug) {
            setAppSlug(slug);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name") as string,
            email: formData.get("email") as string,
            message: formData.get("message") as string,
            app: appSlug || undefined,
        };

        try {
            const response = await fetch("/api/contact", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error("Failed to send message");
            }

            setSubmitted(true);
        } catch (err) {
            setError("Failed to send message. Please try again.");
            console.error("Error submitting form:", err);
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-12 bg-surface2 rounded-3xl border border-accent/20"
            >
                <h3 className="text-2xl font-bold mb-4 text-accent">Message Sent!</h3>
                <p className="text-secondary">We'll get back to you shortly.</p>
                <button onClick={() => setSubmitted(false)} className="mt-6 text-sm underline hover:text-accent">Send another</button>
            </motion.div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-secondary">Name</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        disabled={loading}
                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        placeholder="John Doe"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium text-secondary">Email</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        disabled={loading}
                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        placeholder="john@example.com"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="app" className="text-sm font-medium text-secondary">Interested in App (Optional)</label>
                <div className="relative">
                    <select
                        id="app"
                        value={appSlug}
                        onChange={(e) => setAppSlug(e.target.value)}
                        disabled={loading}
                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary appearance-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                    >
                        <option value="">General Inquiry / No specific app</option>
                        {apps.map(app => (
                            <option key={app.slug} value={app.slug}>{app.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
                        ▼
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-secondary">Message</label>
                <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    disabled={loading}
                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none disabled:opacity-50"
                    placeholder="Tell us about your project or question..."
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "Sending..." : "Send Message"}
            </button>
        </form>
    );
}

export function ContactSection() {
    return (
        <section id="contact" className="py-24 bg-surface">
            <div className="container mx-auto px-4 md:px-6 max-w-3xl">
                <div className="text-center mb-12">
                    <h2 className="text-4xl font-bold mb-4">Contact</h2>
                    <p className="text-secondary text-lg">Interested in NorthByte Studio or one of our apps? Reach out.</p>
                </div>

                <Suspense fallback={<div className="h-[400px] bg-surface2 animate-pulse rounded-3xl" />}>
                    <ContactFormContent />
                </Suspense>
            </div>
        </section>
    );
}
