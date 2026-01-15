"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface SupportFormProps {
    appSlug?: string;
    appName?: string;
}

export function SupportForm({ appSlug, appName }: SupportFormProps) {
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

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
            type: "support" as const,
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
            setError("Message could not be sent. Please try again.");
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
                <h3 className="text-2xl font-bold mb-4 text-accent">Message sent!</h3>
                <p className="text-secondary">We'll get back to you as soon as possible.</p>
                <button
                    onClick={() => setSubmitted(false)}
                    className="mt-6 text-sm underline hover:text-accent transition-colors"
                >
                    Send another message
                </button>
            </motion.div>
        );
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
                    <label htmlFor="name" className="text-sm font-medium text-secondary">
                        Name
                    </label>
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
                    <label htmlFor="email" className="text-sm font-medium text-secondary">
                        Email
                    </label>
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

            {appName && (
                <div className="p-4 bg-surface2 border border-border rounded-xl">
                    <p className="text-sm text-secondary">
                        Support for: <span className="font-semibold text-primary">{appName}</span>
                    </p>
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-secondary">
                    Message
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={6}
                    required
                    disabled={loading}
                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none disabled:opacity-50"
                    placeholder="Describe your issue or question..."
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
