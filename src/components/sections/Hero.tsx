"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Hero() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.8 }
        },
    };

    return (
        <section className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-accent/10 rounded-full blur-[120px] -z-10 mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-accent-blue/10 rounded-full blur-[100px] -z-10 mix-blend-screen pointer-events-none" />

            <div className="container mx-auto px-4 md:px-6 relative z-10">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="max-w-4xl mx-auto text-center"
                >
                    <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.1] mb-6">
                        We build and launch high-quality digital products — <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-blue">fast.</span>
                    </motion.h1>

                    <motion.p variants={itemVariants} className="text-lg md:text-xl text-secondary leading-relaxed mb-10 max-w-2xl mx-auto">
                        Built by experienced developers, guided by AI.
                    </motion.p>

                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            href="/#apps"
                            className="w-full sm:w-auto px-8 py-4 bg-primary text-background rounded-full font-bold text-lg hover:bg-white hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        >
                            View Apps
                        </Link>
                        <Link
                            href="/#contact"
                            className="w-full sm:w-auto px-8 py-4 bg-surface2 border border-border text-primary rounded-full font-bold text-lg hover:bg-surface2/80 hover:border-accent/30 transition-all"
                        >
                            Contact
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
