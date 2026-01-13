"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, TrendingUp } from "lucide-react";

const principles = [
    {
        title: "Simplicity & Marketability",
        text: "We design apps that are easy to understand, easy to explain — and easy to sell.",
        icon: Sparkles,
    },
    {
        title: "AI leveraged development.",
        text: "Years of hands-on experience allow us to guide AI effectively and move fast without losing product clarity.",
        icon: Zap,
    },
    {
        title: "Built for sustainable businesses.",
        text: "Every app is designed with monetization, retention and long-term growth in mind.",
        icon: TrendingUp,
    },
];

export function Principles() {
    return (
        <section className="py-24 relative">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {principles.map((p, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ delay: index * 0.2, duration: 0.6 }}
                            whileHover={{ scale: 1.02 }}
                            className="p-8 rounded-3xl bg-surface border border-border hover:border-accent/20 transition-colors group"
                        >
                            <div className="p-3 bg-surface2 w-fit rounded-2xl mb-6 group-hover:bg-accent/10 transition-colors">
                                <p.icon className="w-8 h-8 text-accent group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">{p.title}</h3>
                            <p className="text-secondary leading-relaxed">{p.text}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
