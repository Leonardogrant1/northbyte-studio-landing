"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../../convex/_generated/api";

export default function CreateAppPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        tagline: "",
        description: "",
        status: "live",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const createApp = useMutation(api.apps.mutations.create);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!formData.name.trim()) {
            setError("App name is required");
            return;
        }
        if (!formData.tagline.trim()) {
            setError("Tagline is required");
            return;
        }
        if (!formData.description.trim()) {
            setError("Description is required");
            return;
        }

        setIsSubmitting(true);

        try {
            const appId = await createApp({
                name: formData.name.trim(),
                tagline: formData.tagline.trim(),
                description: formData.description.trim(),
                status: formData.status,
            });

            // Save as selected app
            localStorage.setItem("selectedAppId", appId);

            // Redirect to app-specific dashboard
            router.push(`/admin/${appId}`);
        } catch (err) {
            setError("Failed to create app. Please try again.");
            console.error(err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-primary p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/admin")}
                        className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-6"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>Back to Dashboard</span>
                    </button>
                    <h1 className="text-4xl font-bold mb-3">Create New App</h1>
                    <p className="text-secondary">
                        Füge eine neue App zu deinem NorthByte Studio hinzu
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-secondary mb-2">
                                App Name *
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="My Awesome App"
                            />
                        </div>

                        <div>
                            <label htmlFor="tagline" className="block text-sm font-medium text-secondary mb-2">
                                Tagline *
                            </label>
                            <input
                                type="text"
                                id="tagline"
                                value={formData.tagline}
                                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                                placeholder="A brief, catchy description"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-secondary mb-2">
                                Description *
                            </label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                disabled={isSubmitting}
                                rows={6}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all resize-none disabled:opacity-50"
                                placeholder="Detailed description of your app, its features, and purpose..."
                            />
                        </div>

                        <div>
                            <label htmlFor="status" className="block text-sm font-medium text-secondary mb-2">
                                Status
                            </label>
                            <select
                                id="status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-surface2 border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all disabled:opacity-50"
                            >
                                <option value="live">Live</option>
                                <option value="coming soon">Coming Soon</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 mt-8">
                        <button
                            type="button"
                            onClick={() => router.push("/admin")}
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-surface2 border border-border rounded-xl text-secondary hover:bg-surface hover:text-primary transition-all disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-3 bg-accent text-background rounded-xl font-medium hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Creating..." : "Create App"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
