"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { AppDropdown } from "./AppDropdown";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminHeader() {
    const currentUser = useCurrentUser();
    const { signOut } = useClerk();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <div className="mb-8">
            {/* Top row: Title with App Selector and User Info */}
            <div className="flex items-center justify-between mb-6">
                {/* Left side: Title and App Selector */}
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                        <p className="text-secondary text-sm">
                            Willkommen im NorthByte Studio Admin-Bereich
                        </p>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                        <span className="text-sm text-secondary font-medium">App:</span>
                        <AppDropdown />
                    </div>
                </div>

                {/* Right side: User Info and Logout */}
                {currentUser && (
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 px-6 py-3 bg-surface2/50 backdrop-blur-xl border border-border rounded-2xl">
                            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                            <span className="text-sm text-secondary">
                                {currentUser.email}
                            </span>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-3 bg-surface2/50 backdrop-blur-xl border border-border rounded-2xl text-secondary hover:text-red-400 hover:border-red-400/30 transition-all"
                            title="Abmelden"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
