"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Home", href: "/" },
        { name: "Apps", href: "/#apps" },
        { name: "Support", href: "/support" },
        { name: "Contact", href: "/#contact" },
    ];

    return (
        <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
                scrolled ? "bg-background/80 backdrop-blur-md border-b border-border py-4" : "bg-transparent py-6"
            )}
        >
            <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                    <Image src="/logo.svg" alt="NorthByte Studio" width={180} height={60} priority className="h-8 md:h-10 w-auto" />
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-sm font-medium text-secondary hover:text-accent transition-colors relative group"
                        >
                            {link.name}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent transition-all group-hover:w-full" />
                        </Link>
                    ))}
                    <div className="relative group">
                        <button className="text-sm font-medium text-secondary hover:text-accent transition-colors flex items-center gap-1">
                            Legal
                        </button>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 overflow-hidden">
                            <Link href="/privacy-policy" className="block px-4 py-2 text-sm text-secondary hover:bg-surface2 hover:text-primary transition-colors">Privacy Policy</Link>
                            <Link href="/terms-of-use" className="block px-4 py-2 text-sm text-secondary hover:bg-surface2 hover:text-primary transition-colors">Terms of Use</Link>
                        </div>
                    </div>

                    <Link
                        href="/#apps"
                        className="px-5 py-2 bg-surface2 hover:bg-surface2/80 border border-border rounded-full text-sm font-semibold transition-all hover:scale-105"
                    >
                        View Apps
                    </Link>
                </nav>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden text-primary"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Nav */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-surface border-b border-border overflow-hidden"
                    >
                        <nav className="flex flex-col p-4 gap-4">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-lg font-medium text-secondary hover:text-accent"
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <div className="py-2 border-t border-border mt-2">
                                <Link href="/privacy-policy" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-secondary">Privacy Policy</Link>
                                <Link href="/terms-of-use" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-secondary">Terms of Use</Link>
                            </div>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}
