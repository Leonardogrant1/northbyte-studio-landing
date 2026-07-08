"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { useState, useEffect, useRef } from "react";
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
            <span className="px-3 py-1.5 text-xs font-medium rounded-lg border border-accent bg-accent/10 text-accent flex items-center gap-1.5">
                <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
                Subscribed
            </span>
        );
    }
    
    return (
        <button
            onClick={onSubscribe}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-surface hover:bg-surface2 hover:border-accent transition-all flex items-center gap-1.5"
        >
            <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
            </svg>
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
    const [activeFilter, setActiveFilter] = useState<"all" | "in-progress" | "open" | "resolved">("all");
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef<HTMLDivElement>(null);
    
    // Subscribe dialog state
    const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
    const [subscribeBugId, setSubscribeBugId] = useState<Id<"bugs"> | null>(null);
    const [subscribeEmail, setSubscribeEmail] = useState("");
    const [isSubscribing, setIsSubscribing] = useState(false);

    // Resolve params
    useEffect(() => {
        params.then((p) => setProjectId(p.projectId));
    }, [params]);

    // Close filter dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
                setIsFilterDropdownOpen(false);
            }
        }

        if (isFilterDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isFilterDropdownOpen]);

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
    const allBugs = useQuery(
        api.bugs.queries.getByApp,
        app ? { appId: app._id } : "skip"
    );

    // Filter bugs based on active filter
    const bugs = allBugs?.filter((bug) => {
        if (activeFilter === "all") return true;
        return bug.status === activeFilter;
    });

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

    // Helper function to format relative time
    const formatRelativeTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return "Created just now";
        if (minutes < 60) return `Last activity ${minutes}m ago`;
        if (hours < 24) return `Last activity ${hours}h ago`;
        if (days < 7) return `Last activity ${days}d ago`;
        return `Created ${new Date(timestamp).toLocaleDateString()}`;
    };

    // Helper function to get status label
    const getStatusLabel = (status: string): string => {
        switch (status) {
            case "open":
                return "Open";
            case "in-progress":
                return "In Progress";
            case "resolved":
                return "Resolved";
            default:
                return status;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Header />
            <main className="flex-1 container mx-auto px-4 md:px-6 pt-32 pb-20 max-w-4xl">
                {/* Header Section */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Bug Reports for {app.name}
                    </h1>
                    <p className="text-secondary text-lg max-w-2xl mx-auto">
                        {app.tagline} Help us improve your experience by reporting issues or requesting features.
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
                    {/* Mobile: Custom Dropdown */}
                    <div className="md:hidden relative" ref={filterDropdownRef}>
                        <button
                            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:border-accent flex items-center justify-between"
                        >
                            <span>
                                {activeFilter === "all" ? "All Reports" :
                                 activeFilter === "in-progress" ? "In Progress" :
                                 activeFilter === "open" ? "Planned" : "Closed"}
                            </span>
                            <svg
                                className={`w-4 h-4 transition-transform ${isFilterDropdownOpen ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                />
                            </svg>
                        </button>
                        {isFilterDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setActiveFilter("all");
                                        setIsFilterDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-surface2 transition-colors ${
                                        activeFilter === "all" ? "bg-accent/10" : ""
                                    }`}
                                >
                                    All Reports
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter("in-progress");
                                        setIsFilterDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-surface2 transition-colors ${
                                        activeFilter === "in-progress" ? "bg-accent/10" : ""
                                    }`}
                                >
                                    In Progress
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter("open");
                                        setIsFilterDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-surface2 transition-colors ${
                                        activeFilter === "open" ? "bg-accent/10" : ""
                                    }`}
                                >
                                    Planned
                                </button>
                                <button
                                    onClick={() => {
                                        setActiveFilter("resolved");
                                        setIsFilterDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-surface2 transition-colors ${
                                        activeFilter === "resolved" ? "bg-accent/10" : ""
                                    }`}
                                >
                                    Closed
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Desktop: Tabs */}
                    <div className="hidden md:flex gap-2">
                        <button
                            onClick={() => setActiveFilter("all")}
                            className={`px-4 py-2 font-medium transition-colors ${
                                activeFilter === "all"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-secondary hover:text-primary"
                            }`}
                        >
                            All Reports
                        </button>
                        <button
                            onClick={() => setActiveFilter("in-progress")}
                            className={`px-4 py-2 font-medium transition-colors ${
                                activeFilter === "in-progress"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-secondary hover:text-primary"
                            }`}
                        >
                            In Progress
                        </button>
                        <button
                            onClick={() => setActiveFilter("open")}
                            className={`px-4 py-2 font-medium transition-colors ${
                                activeFilter === "open"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-secondary hover:text-primary"
                            }`}
                        >
                            Planned
                        </button>
                        <button
                            onClick={() => setActiveFilter("resolved")}
                            className={`px-4 py-2 font-medium transition-colors ${
                                activeFilter === "resolved"
                                    ? "text-primary border-b-2 border-primary"
                                    : "text-secondary hover:text-primary"
                            }`}
                        >
                            Closed
                        </button>
                    </div>
                    <button
                        onClick={() => setShowDialog(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-background rounded-lg hover:bg-white transition-all w-full md:w-auto justify-center"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Report New Bug
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
                        <div className="text-center py-8">
                            <p className="text-secondary text-sm">
                                No bugs reported yet. Be the first!
                            </p>
                        </div>
                    ) : (
                        bugs.map((bug) => {
                            const isUpvoted = hasUpvoted(bug._id);
                            
                            return (
                                <div
                                    key={bug._id}
                                    className="bg-surface border border-border rounded-2xl p-4 hover:border-accent transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Left: Upvote Section */}
                                        <button
                                            onClick={() => handleUpvote(bug._id)}
                                            disabled={isUpvoted}
                                            className={`flex flex-col items-center gap-0.5 min-w-[40px] ${
                                                isUpvoted
                                                    ? "cursor-not-allowed opacity-60"
                                                    : "hover:opacity-80"
                                            } transition-opacity`}
                                        >
                                            <svg
                                                className={`w-4 h-4 ${
                                                    isUpvoted ? "text-accent" : "text-secondary"
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
                                            <span className={`text-base font-bold px-2 py-1 rounded border ${
                                                isUpvoted 
                                                    ? "text-accent border-accent bg-accent/10" 
                                                    : "text-primary border-border bg-surface2"
                                            }`}>
                                                {bug.upvotes}
                                            </span>
                                        </button>

                                        {/* Right: Bug Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3 mb-1.5">
                                                <h3 className="text-lg font-bold text-primary">
                                                    {bug.title}
                                                </h3>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap ${
                                                        bug.status === "open"
                                                            ? "bg-red-500/10 text-red-400"
                                                            : bug.status === "in-progress"
                                                            ? "bg-yellow-500/10 text-yellow-400"
                                                            : "bg-green-500/10 text-green-400"
                                                    }`}
                                                >
                                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                                    {getStatusLabel(bug.status)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-secondary mb-3">
                                                {bug.description}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-secondary">
                                                    {formatRelativeTime(bug._creationTime)}
                                                </span>
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
