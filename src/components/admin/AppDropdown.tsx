"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAppId } from "@/hooks/useAppId";

interface App {
    _id: Id<"apps">;
    name: string;
    tagline: string;
    description: string;
    status: string;
}

export function AppDropdown() {
    const router = useRouter();
    const currentAppId = useAppId();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<App | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const apps = useQuery(api.apps.queries.getAll);

    // Sync selected app with URL appId
    useEffect(() => {
        if (currentAppId && apps) {
            const app = apps.find((a) => a._id === currentAppId);
            if (app) {
                setSelectedApp(app);
                localStorage.setItem("selectedAppId", app._id);
            }
        } else if (!currentAppId && apps && apps.length > 0) {
            // If no appId in URL, try to load from localStorage
            const savedAppId = localStorage.getItem("selectedAppId");
            if (savedAppId) {
                const app = apps.find((a) => a._id === savedAppId);
                if (app) {
                    setSelectedApp(app);
                }
            }
        }
    }, [currentAppId, apps]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleSelectApp = (app: App) => {
        setSelectedApp(app);
        localStorage.setItem("selectedAppId", app._id);
        setIsOpen(false);
        // Navigate to the app's dashboard
        router.push(`/admin/${app._id}`);
    };

    const handleAddApp = () => {
        setIsOpen(false);
        router.push("/admin/create-app");
    };

    if (!apps || apps.length === 0) {
        return (
            <button
                onClick={() => router.push("/admin/create-app")}
                className="flex items-center gap-2 px-4 py-2 bg-surface2/50 backdrop-blur-xl border border-border rounded-xl hover:bg-surface2 transition-all duration-200"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm">Create your first app</span>
            </button>
        );
    }

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 px-4 py-2.5 bg-surface2/50 backdrop-blur-xl border border-border rounded-xl hover:bg-surface2 transition-all duration-200 min-w-[200px]"
                >
                    <div className="flex-1 text-left">
                        <div className="text-sm font-medium text-primary">
                            {selectedApp?.name || "Select an app"}
                        </div>
                        {selectedApp && (
                            <div className="text-xs text-muted truncate">
                                {selectedApp.tagline}
                            </div>
                        )}
                    </div>
                    <svg
                        className={`w-4 h-4 text-secondary transition-transform duration-200 ${isOpen ? "rotate-180" : ""
                            }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-[400px] overflow-y-auto">
                            {/* App List */}
                            <div className="p-2">
                                {apps.map((app) => (
                                    <button
                                        key={app._id}
                                        onClick={() => handleSelectApp(app)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 ${selectedApp?._id === app._id
                                            ? "bg-accent/10 border border-accent/20"
                                            : "hover:bg-surface2 border border-transparent"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-primary">
                                                    {app.name}
                                                </div>
                                                <div className="text-xs text-muted truncate">
                                                    {app.tagline}
                                                </div>
                                            </div>
                                            {selectedApp?._id === app._id && (
                                                <svg
                                                    className="w-4 h-4 text-accent"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M5 13l4 4L19 7"
                                                    />
                                                </svg>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-border mx-2" />

                            {/* Add New App Button */}
                            <div className="p-2">
                                <button
                                    onClick={handleAddApp}
                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface2 transition-all duration-150 flex items-center gap-2 text-accent"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="text-sm font-medium">Add new App</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
