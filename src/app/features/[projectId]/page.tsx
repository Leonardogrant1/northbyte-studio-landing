"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Subscribe Button Component
function SubscribeButton({ 
    featureId, 
    onSubscribe 
}: { 
    featureId: Id<"features">; 
    onSubscribe: () => void;
}) {
    const storedEmail = typeof window !== "undefined" 
        ? localStorage.getItem("lastSubscribeEmail") || ""
        : "";
    
    // Check subscription status using query
    const isSubscribed = useQuery(
        api.features.queries.isSubscribed,
        storedEmail ? { featureId, email: storedEmail } : "skip"
    );
    
    // Also check localStorage as fallback
    const localSubscribed = storedEmail 
        ? (() => {
            const subscriptions = localStorage.getItem("featureSubscriptions");
            if (!subscriptions) return false;
            try {
                const subscriptionsData: Record<string, string[]> = JSON.parse(subscriptions);
                const featureSubscriptions = subscriptionsData[featureId] || [];
                return featureSubscriptions.includes(storedEmail.toLowerCase());
            } catch {
                return false;
            }
        })()
        : false;
    
    const subscribed = isSubscribed !== undefined ? isSubscribed : localSubscribed;
    
    if (subscribed) {
        return (
            <span className="px-4 py-2 text-sm font-medium rounded-xl border border-accent bg-accent/10 text-accent">
                Subscribed
            </span>
        );
    }
    
    return (
        <button
            onClick={onSubscribe}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border bg-surface hover:bg-surface2 hover:border-accent transition-all"
        >
            Subscribe
        </button>
    );
}

interface PageProps {
    params: Promise<{
        projectId: string;
    }>;
}

export default function FeaturesPage({ params }: PageProps) {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [newFeatureTitle, setNewFeatureTitle] = useState("");
    const [newFeatureDescription, setNewFeatureDescription] = useState("");
    const [newFeatureEmail, setNewFeatureEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Subscribe dialog state
    const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
    const [subscribeFeatureId, setSubscribeFeatureId] = useState<Id<"features"> | null>(null);
    const [subscribeEmail, setSubscribeEmail] = useState("");
    const [isSubscribing, setIsSubscribing] = useState(false);

    // Resolve params
    useEffect(() => {
        params.then((p) => setProjectId(p.projectId));
    }, [params]);

    // Close dialog on ESC key
    useEffect(() => {
        if (!showDialog && !showSubscribeDialog) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showDialog && !isSubmitting) {
                    setShowDialog(false);
                    setNewFeatureTitle("");
                    setNewFeatureDescription("");
                    setNewFeatureEmail("");
                }
                if (showSubscribeDialog && !isSubscribing) {
                    handleCloseSubscribeDialog();
                }
            }
        };

        document.addEventListener("keydown", handleEscape);
        // Prevent body scroll when dialog is open
        if (showDialog || showSubscribeDialog) {
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [showDialog, showSubscribeDialog, isSubmitting, isSubscribing]);

    // Get all apps to find by slug, name, or ID
    const allApps = useQuery(api.apps.queries.getAll);
    
    // Find app by slug, name, or ID
    const app = projectId
        ? allApps?.find(
              (a) =>
                  a.slug === projectId ||
                  a.name.toLowerCase() === projectId.toLowerCase() ||
                  a._id === (projectId as Id<"apps">)
          )
        : null;

    // Get features for the app
    const features = useQuery(
        api.features.queries.getByApp,
        app ? { appId: app._id } : "skip"
    );

    const upvoteMutation = useMutation(api.features.mutations.upvote);
    const createFeatureMutation = useMutation(api.features.mutations.create);
    const subscribeMutation = useMutation(api.features.mutations.subscribe);
    
    // Check if email is subscribed to feature (using localStorage)
    const isEmailSubscribed = (featureId: Id<"features">, email: string): boolean => {
        if (typeof window === "undefined" || !email) return false;
        
        const subscriptions = localStorage.getItem("featureSubscriptions");
        if (!subscriptions) return false;

        try {
            const subscriptionsData: Record<string, string[]> = JSON.parse(subscriptions);
            const featureSubscriptions = subscriptionsData[featureId] || [];
            return featureSubscriptions.includes(email.toLowerCase());
        } catch {
            return false;
        }
    };

    // Save subscription to localStorage
    const saveSubscription = (featureId: Id<"features">, email: string) => {
        if (typeof window === "undefined") return;
        
        const subscriptions = localStorage.getItem("featureSubscriptions");
        let subscriptionsData: Record<string, string[]> = {};
        
        if (subscriptions) {
            try {
                subscriptionsData = JSON.parse(subscriptions);
            } catch {
                subscriptionsData = {};
            }
        }
        
        if (!subscriptionsData[featureId]) {
            subscriptionsData[featureId] = [];
        }
        
        const emailLower = email.toLowerCase();
        if (!subscriptionsData[featureId].includes(emailLower)) {
            subscriptionsData[featureId].push(emailLower);
        }
        
        localStorage.setItem("featureSubscriptions", JSON.stringify(subscriptionsData));
    };
    
    const handleOpenSubscribeDialog = (featureId: Id<"features">) => {
        setSubscribeFeatureId(featureId);
        setSubscribeEmail("");
        setShowSubscribeDialog(true);
    };
    
    const handleCloseSubscribeDialog = () => {
        if (!isSubscribing) {
            setShowSubscribeDialog(false);
            setSubscribeFeatureId(null);
            setSubscribeEmail("");
        }
    };
    
    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subscribeFeatureId || !subscribeEmail.trim()) return;
        
        setIsSubscribing(true);
        try {
            await subscribeMutation({
                featureId: subscribeFeatureId,
                email: subscribeEmail.trim(),
            });
            // Save to localStorage
            saveSubscription(subscribeFeatureId, subscribeEmail.trim());
            // Store email for future checks
            if (typeof window !== "undefined") {
                localStorage.setItem("lastSubscribeEmail", subscribeEmail.trim());
            }
            setShowSubscribeDialog(false);
            setSubscribeFeatureId(null);
            setSubscribeEmail("");
        } catch (error) {
            console.error("Error subscribing to feature:", error);
        } finally {
            setIsSubscribing(false);
        }
    };

    // Check if a feature was upvoted within the last 20 minutes
    const hasUpvoted = (featureId: Id<"features">): boolean => {
        if (typeof window === "undefined") return false;
        
        const upvotes = localStorage.getItem("featureUpvotes");
        if (!upvotes) return false;

        try {
            const upvotesData: Record<string, number> = JSON.parse(upvotes);
            const timestamp = upvotesData[featureId];
            
            if (!timestamp) return false;
            
            // Check if less than 20 minutes (1200000 ms) have passed
            const twentyMinutes = 20 * 60 * 1000;
            const now = Date.now();
            return (now - timestamp) < twentyMinutes;
        } catch {
            return false;
        }
    };

    // Save upvote timestamp to localStorage
    const saveUpvote = (featureId: Id<"features">) => {
        if (typeof window === "undefined") return;
        
        const upvotes = localStorage.getItem("featureUpvotes");
        let upvotesData: Record<string, number> = {};
        
        if (upvotes) {
            try {
                upvotesData = JSON.parse(upvotes);
            } catch {
                upvotesData = {};
            }
        }
        
        upvotesData[featureId] = Date.now();
        localStorage.setItem("featureUpvotes", JSON.stringify(upvotesData));
    };

    const handleUpvote = async (featureId: Id<"features">) => {
        // Check if already upvoted within 20 minutes
        if (hasUpvoted(featureId)) {
            return;
        }

        try {
            await upvoteMutation({ featureId });
            // Save to localStorage after successful upvote
            saveUpvote(featureId);
        } catch (error) {
            console.error("Error upvoting feature:", error);
        }
    };

    const handleSubmitFeature = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app || !newFeatureTitle.trim() || !newFeatureDescription.trim() || !newFeatureEmail.trim()) return;

        setIsSubmitting(true);
        try {
            // Create the feature
            const featureId = await createFeatureMutation({
                appId: app._id,
                title: newFeatureTitle.trim(),
                description: newFeatureDescription.trim(),
                status: "planned",
            });

            // Subscribe the user to the feature
            if (featureId && newFeatureEmail.trim()) {
                try {
                    await subscribeMutation({
                        featureId: featureId as Id<"features">,
                        email: newFeatureEmail.trim(),
                    });
                } catch (subscribeError) {
                    // Log but don't fail the whole operation if subscription fails
                    console.error("Error subscribing to feature:", subscribeError);
                }
            }

            // Reset form and close dialog
            setNewFeatureTitle("");
            setNewFeatureDescription("");
            setNewFeatureEmail("");
            setShowDialog(false);
        } catch (error) {
            console.error("Error creating feature:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseDialog = () => {
        if (!isSubmitting) {
            setShowDialog(false);
            setNewFeatureTitle("");
            setNewFeatureDescription("");
            setNewFeatureEmail("");
        }
    };

    if (allApps === undefined || !projectId) {
        return (
            <div className="min-h-screen bg-background">
                <Header />
                <div className="container mx-auto px-4 md:px-6 py-32 text-center">
                            <p className="text-secondary">Loading...</p>
                </div>
                <Footer />
            </div>
        );
    }

    if (allApps !== undefined && !app) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <Header />
                <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20 max-w-4xl text-center">
                    <h1 className="text-4xl font-bold mb-4">App not found</h1>
                    <p className="text-secondary">
                        The app "{projectId}" could not be found.
                    </p>
                </main>
                <Footer />
            </div>
        );
    }

    if (!app) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Feature Requests for {app.name}
                    </h1>
                    <p className="text-secondary text-lg">
                        {app.tagline}
                    </p>
                </div>

                {/* Add Feature Button */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowDialog(true)}
                        className="px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:bg-accent/90 transition-all shadow-lg"
                    >
                        + Create New Feature Request
                    </button>
                </div>

                {/* Dialog/Modal */}
                {showDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={handleCloseDialog}
                        />
                        
                        {/* Dialog Content */}
                        <div className="relative bg-surface2 border border-border rounded-3xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">
                                    Create New Feature Request
                                </h2>
                                <button
                                    onClick={handleCloseDialog}
                                    disabled={isSubmitting}
                                    className="text-secondary hover:text-primary transition-colors disabled:opacity-50"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmitFeature} className="space-y-4">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="email"
                                        className="text-sm font-medium text-secondary"
                                    >
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={newFeatureEmail}
                                        onChange={(e) =>
                                            setNewFeatureEmail(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="your@email.com"
                                    />
                                    <p className="text-xs text-secondary">
                                        You will be notified about updates to this feature.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="title"
                                        className="text-sm font-medium text-secondary"
                                    >
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        value={newFeatureTitle}
                                        onChange={(e) =>
                                            setNewFeatureTitle(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Brief description of the feature"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label
                                        htmlFor="description"
                                        className="text-sm font-medium text-secondary"
                                    >
                                        Description *
                                    </label>
                                    <textarea
                                        id="description"
                                        value={newFeatureDescription}
                                        onChange={(e) =>
                                            setNewFeatureDescription(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        rows={6}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none disabled:opacity-50"
                                        placeholder="Detailed description of the feature..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? "Creating..." : "Create Feature Request"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseDialog}
                                        disabled={isSubmitting}
                                        className="px-6 py-3 bg-surface border border-border font-semibold rounded-xl hover:bg-surface2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Features List */}
                <div className="space-y-4">
                    {features === undefined ? (
                        <div className="text-center py-12">
                            <p className="text-secondary">Loading features...</p>
                        </div>
                    ) : features.length === 0 ? (
                        <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-12 text-center">
                            <p className="text-secondary text-lg">
                                No feature requests yet. Be the first!
                            </p>
                        </div>
                    ) : (
                        features.map((feature) => {
                            const isUpvoted = hasUpvoted(feature._id);
                            
                            return (
                                <div
                                    key={feature._id}
                                    className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-6 hover:border-accent/50 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <button
                                            onClick={() => handleUpvote(feature._id)}
                                            disabled={isUpvoted}
                                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all group min-w-[60px] ${
                                                isUpvoted
                                                    ? "bg-accent/20 border-accent cursor-not-allowed"
                                                    : "bg-surface border border-border hover:border-accent hover:bg-surface"
                                            }`}
                                        >
                                            <svg
                                                className={`w-5 h-5 transition-colors ${
                                                    isUpvoted
                                                        ? "text-accent"
                                                        : "text-secondary group-hover:text-accent"
                                                }`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M5 15l7-7 7 7"
                                                />
                                            </svg>
                                            <span className={`text-lg font-bold ${
                                                isUpvoted ? "text-accent" : "text-primary"
                                            }`}>
                                                {feature.upvotes}
                                            </span>
                                        </button>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold mb-2">
                                            {feature.title}
                                        </h3>
                                        <p className="text-secondary mb-3">
                                            {feature.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        feature.status === "planned"
                                                            ? "bg-blue-500/10 text-blue-400"
                                                            : feature.status === "in-development"
                                                            ? "bg-yellow-500/10 text-yellow-400"
                                                            : "bg-green-500/10 text-green-400"
                                                    }`}
                                                >
                                                    {feature.status === "planned"
                                                        ? "Planned"
                                                        : feature.status === "in-development"
                                                        ? "In Development"
                                                        : "Completed"}
                                                </span>
                                            </div>
                                            <SubscribeButton
                                                featureId={feature._id}
                                                onSubscribe={() => handleOpenSubscribeDialog(feature._id)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>

                {/* Subscribe Dialog */}
                {showSubscribeDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={handleCloseSubscribeDialog}
                        />
                        
                        {/* Dialog Content */}
                        <div className="relative bg-surface2 border border-border rounded-3xl p-6 md:p-8 w-full max-w-md">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold">
                                    Subscribe to Feature
                                </h2>
                                <button
                                    onClick={handleCloseSubscribeDialog}
                                    disabled={isSubscribing}
                                    className="text-secondary hover:text-primary transition-colors disabled:opacity-50"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubscribe} className="space-y-4">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="subscribe-email"
                                        className="text-sm font-medium text-secondary"
                                    >
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        id="subscribe-email"
                                        value={subscribeEmail}
                                        onChange={(e) =>
                                            setSubscribeEmail(e.target.value)
                                        }
                                        required
                                        disabled={isSubscribing}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="your@email.com"
                                    />
                                    <p className="text-xs text-secondary">
                                        You will be notified about updates to this feature.
                                    </p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubscribing}
                                        className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubscribing ? "Subscribing..." : "Subscribe"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseSubscribeDialog}
                                        disabled={isSubscribing}
                                        className="px-6 py-3 bg-surface border border-border font-semibold rounded-xl hover:bg-surface2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
