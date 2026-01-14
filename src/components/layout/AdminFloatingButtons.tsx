"use client";

import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogOut } from "lucide-react";

export function AdminFloatingButtons() {
    const { userId } = useAuth();
    const { signOut } = useClerk();
    const router = useRouter();
    const pathname = usePathname();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function checkAdmin() {
            if (!userId) {
                setIsAdmin(false);
                setIsLoading(false);
                return;
            }

            try {
                // Check if user has @northbyte.studio email
                const response = await fetch("/api/admin/check");
                const data = await response.json();
                setIsAdmin(data.isAdmin);
            } catch (error) {
                console.error("Error checking admin status:", error);
                setIsAdmin(false);
            } finally {
                setIsLoading(false);
            }
        }

        checkAdmin();
    }, [userId]);

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    // Don't show on admin routes
    if (pathname?.startsWith("/admin")) {
        return null;
    }

    if (isLoading || !isAdmin) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-6 right-6 flex gap-3 z-50"
            >
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => router.push("/admin")}
                    className="flex items-center gap-2 px-4 py-3 bg-surface2/80 backdrop-blur-xl border border-accent/30 rounded-xl text-accent font-medium shadow-lg hover:bg-surface2 transition-all"
                    title="Zum Dashboard"
                >
                    <LayoutDashboard size={20} />
                    <span className="hidden sm:inline">Dashboard</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-3 bg-surface2/80 backdrop-blur-xl border border-border rounded-xl text-secondary font-medium shadow-lg hover:bg-surface2 hover:text-red-400 hover:border-red-400/30 transition-all"
                    title="Abmelden"
                >
                    <LogOut size={20} />
                    <span className="hidden sm:inline">Logout</span>
                </motion.button>
            </motion.div>
        </AnimatePresence>
    );
}
