"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Subscribe Button Component
function SubscribeButton({ 
    bugId, 
    onSubscribe 
}: { 
    bugId: Id<"bugs">; 
    onSubscribe: () => void;
}) {
    const storedEmail = typeof window !== "undefined" 
        ? localStorage.getItem("lastSubscribeEmail") || ""
        : "";
    
    // Check subscription status using query
    const isSubscribed = useQuery(
        api.bugs.queries.isSubscribed,
        storedEmail ? { bugId, email: storedEmail } : "skip"
    );
    
    // Also check localStorage as fallback
    const localSubscribed = storedEmail 
        ? (() => {
            const subscriptions = localStorage.getItem("bugSubscriptions");
            if (!subscriptions) return false;
            try {
                const subscriptionsData: Record<string, string[]> = JSON.parse(subscriptions);
                const bugSubscriptions = subscriptionsData[bugId] || [];
                return bugSubscriptions.includes(storedEmail.toLowerCase());
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

export default function BugsPage({ params }: PageProps) {
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [newBugTitle, setNewBugTitle] = useState("");
    const [newBugDescription, setNewBugDescription] = useState("");
    const [newBugEmail, setNewBugEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Subscribe dialog state
    const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
    const [subscribeBugId, setSubscribeBugId] = useState<Id<"bugs"> | null>(null);
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
                    setNewBugTitle("");
                    setNewBugDescription("");
                    setNewBugEmail("");
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

    // Get bugs for the app
    const bugs = useQuery(
        api.bugs.queries.getByApp,
        app ? { appId: app._id } : "skip"
    );

    const upvoteMutation = useMutation(api.bugs.mutations.upvote);
    const createBugMutation = useMutation(api.bugs.mutations.create);
    const subscribeMutation = useMutation(api.bugs.mutations.subscribe);
    
    // Check if email is subscribed to bug (using localStorage)
    const isEmailSubscribed = (bugId: Id<"bugs">, email: string): boolean => {
        if (typeof window === "undefined" || !email) return false;
        
        const subscriptions = localStorage.getItem("bugSubscriptions");
        if (!subscriptions) return false;

        try {
            const subscriptionsData: Record<string, string[]> = JSON.parse(subscriptions);
            const bugSubscriptions = subscriptionsData[bugId] || [];
            return bugSubscriptions.includes(email.toLowerCase());
        } catch {
            return false;
        }
    };

    // Save subscription to localStorage
    const saveSubscription = (bugId: Id<"bugs">, email: string) => {
        if (typeof window === "undefined") return;
        
        const subscriptions = localStorage.getItem("bugSubscriptions");
        let subscriptionsData: Record<string, string[]> = {};
        
        if (subscriptions) {
            try {
                subscriptionsData = JSON.parse(subscriptions);
            } catch {
                subscriptionsData = {};
            }
        }
        
        if (!subscriptionsData[bugId]) {
            subscriptionsData[bugId] = [];
        }
        
        const emailLower = email.toLowerCase();
        if (!subscriptionsData[bugId].includes(emailLower)) {
            subscriptionsData[bugId].push(emailLower);
        }
        
        localStorage.setItem("bugSubscriptions", JSON.stringify(subscriptionsData));
    };
    
    const handleOpenSubscribeDialog = (bugId: Id<"bugs">) => {
        setSubscribeBugId(bugId);
        setSubscribeEmail("");
        setShowSubscribeDialog(true);
    };
    
    const handleCloseSubscribeDialog = () => {
        if (!isSubscribing) {
            setShowSubscribeDialog(false);
            setSubscribeBugId(null);
            setSubscribeEmail("");
        }
    };
    
    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subscribeBugId || !subscribeEmail.trim()) return;
        
        setIsSubscribing(true);
        try {
            await subscribeMutation({
                bugId: subscribeBugId,
                email: subscribeEmail.trim(),
            });
            // Save to localStorage
            saveSubscription(subscribeBugId, subscribeEmail.trim());
            // Store email for future checks
            if (typeof window !== "undefined") {
                localStorage.setItem("lastSubscribeEmail", subscribeEmail.trim());
            }
            setShowSubscribeDialog(false);
            setSubscribeBugId(null);
            setSubscribeEmail("");
        } catch (error) {
            console.error("Error subscribing to bug:", error);
        } finally {
            setIsSubscribing(false);
        }
    };

    // Check if a bug was upvoted within the last 20 minutes
    const hasUpvoted = (bugId: Id<"bugs">): boolean => {
        if (typeof window === "undefined") return false;
        
        const upvotes = localStorage.getItem("bugUpvotes");
        if (!upvotes) return false;

        try {
            const upvotesData: Record<string, number> = JSON.parse(upvotes);
            const timestamp = upvotesData[bugId];
            
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
    const saveUpvote = (bugId: Id<"bugs">) => {
        if (typeof window === "undefined") return;
        
        const upvotes = localStorage.getItem("bugUpvotes");
        let upvotesData: Record<string, number> = {};
        
        if (upvotes) {
            try {
                upvotesData = JSON.parse(upvotes);
            } catch {
                upvotesData = {};
            }
        }
        
        upvotesData[bugId] = Date.now();
        localStorage.setItem("bugUpvotes", JSON.stringify(upvotesData));
    };

    const handleUpvote = async (bugId: Id<"bugs">) => {
        // Check if already upvoted within 20 minutes
        if (hasUpvoted(bugId)) {
            return;
        }

        try {
            await upvoteMutation({ bugId });
            // Save to localStorage after successful upvote
            saveUpvote(bugId);
        } catch (error) {
            console.error("Error upvoting bug:", error);
        }
    };

    const handleSubmitBug = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app || !newBugTitle.trim() || !newBugDescription.trim() || !newBugEmail.trim()) return;

        setIsSubmitting(true);
        try {
            // Create the bug
            const bugId = await createBugMutation({
                appId: app._id,
                title: newBugTitle.trim(),
                description: newBugDescription.trim(),
                status: "open",
            });

            // Subscribe the user to the bug
            if (bugId && newBugEmail.trim()) {
                try {
                    await subscribeMutation({
                        bugId: bugId as Id<"bugs">,
                        email: newBugEmail.trim(),
                    });
                } catch (subscribeError) {
                    // Log but don't fail the whole operation if subscription fails
                    console.error("Error subscribing to bug:", subscribeError);
                }
            }

            // Reset form and close dialog
            setNewBugTitle("");
            setNewBugDescription("");
            setNewBugEmail("");
            setShowDialog(false);
        } catch (error) {
            console.error("Error creating bug:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseDialog = () => {
        if (!isSubmitting) {
            setShowDialog(false);
            setNewBugTitle("");
            setNewBugDescription("");
            setNewBugEmail("");
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
                        Bug Reports for {app.name}
                    </h1>
                    <p className="text-secondary text-lg">
                        {app.tagline}
                    </p>
                </div>

                {/* Add Bug Button */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowDialog(true)}
                        className="px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:bg-accent/90 transition-all shadow-lg"
                    >
                        + Report New Bug
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
                                    Report New Bug
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

                            <form onSubmit={handleSubmitBug} className="space-y-4">
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
                                        value={newBugEmail}
                                        onChange={(e) =>
                                            setNewBugEmail(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="your@email.com"
                                    />
                                    <p className="text-xs text-secondary">
                                        You will be notified about updates to this bug.
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
                                        value={newBugTitle}
                                        onChange={(e) =>
                                            setNewBugTitle(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Brief description of the bug"
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
                                        value={newBugDescription}
                                        onChange={(e) =>
                                            setNewBugDescription(e.target.value)
                                        }
                                        required
                                        disabled={isSubmitting}
                                        rows={6}
                                        className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none disabled:opacity-50"
                                        placeholder="Detailed description of the bug..."
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? "Creating..." : "Report Bug"}
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

                {/* Bugs List */}
                <div className="space-y-4">
                    {bugs === undefined ? (
                        <div className="text-center py-12">
                            <p className="text-secondary">Loading bugs...</p>
                        </div>
                    ) : bugs.length === 0 ? (
                        <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-12 text-center">
                            <p className="text-secondary text-lg">
                                No bugs reported yet. Be the first!
                            </p>
                        </div>
                    ) : (
                        bugs.map((bug) => {
                            const isUpvoted = hasUpvoted(bug._id);
                            
                            return (
                                <div
                                    key={bug._id}
                                    className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-6 hover:border-accent/50 transition-all"
                                >
                                    <div className="flex items-start gap-4">
                                        <button
                                            onClick={() => handleUpvote(bug._id)}
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
                                                {bug.upvotes}
                                            </span>
                                        </button>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold mb-2">
                                            {bug.title}
                                        </h3>
                                        <p className="text-secondary mb-3">
                                            {bug.description}
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        bug.status === "open"
                                                            ? "bg-red-500/10 text-red-400"
                                                            : bug.status ===
                                                              "in-progress"
                                                            ? "bg-yellow-500/10 text-yellow-400"
                                                            : "bg-green-500/10 text-green-400"
                                                    }`}
                                                >
                                                    {bug.status === "open"
                                                        ? "Open"
                                                        : bug.status === "in-progress"
                                                        ? "In Progress"
                                                        : "Resolved"}
                                                </span>
                                            </div>
                                            <SubscribeButton
                                                bugId={bug._id}
                                                onSubscribe={() => handleOpenSubscribeDialog(bug._id)}
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
                                    Subscribe to Bug
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
                                        You will be notified about updates to this bug.
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
