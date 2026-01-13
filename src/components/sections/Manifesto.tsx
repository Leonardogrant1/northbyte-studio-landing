"use client";

import { motion } from "framer-motion";

export function Manifesto() {
    return (
        <section className="py-32 flex justify-center text-center">
            <div className="container mx-auto px-4 md:px-6 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                >
                    <p className="text-2xl md:text-4xl font-semibold leading-tight text-secondary">
                        <span className="text-primary">NorthByte Studio</span> builds consumer apps with clarity at the core.
                        We ship fast by keeping products simple — and we design them to be <span className="text-accent">easy to market</span> from day one.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
