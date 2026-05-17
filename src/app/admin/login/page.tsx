"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
    const { signIn, setActive, isLoaded } = useSignIn();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [needs2FA, setNeeds2FA] = useState(false);
    const [showPassword, setShowPassword] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signIn) return;
        setError("");


        setLoading(true);

        try {
            if (needs2FA) {
                const result = await signIn.attemptSecondFactor({
                    strategy: "totp",
                    code,
                });

                if (result.status === "complete") {
                    await setActive!({ session: result.createdSessionId });
                    router.push("/admin");
                }
            } else {
                const result = await signIn.create({
                    identifier: email,
                    password,
                });

                if (result.status === "complete") {
                    await setActive!({ session: result.createdSessionId });
                    router.push("/admin");
                } else if (result.status === "needs_second_factor") {
                    setNeeds2FA(true);
                }
            }
        } catch (err: unknown) {
            if (err && typeof err === "object" && "errors" in err) {
                const clerkError = err as { errors: Array<{ message: string }> };
                setError(clerkError.errors[0]?.message || "Login fehlgeschlagen.");
            } else {
                setError("Login fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Admin Login</h1>
                    <p className="text-secondary">NorthByte Studio Dashboard</p>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                            >
                                {error}
                            </motion.div>
                        )}

                        {!needs2FA ? (
                            <>
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-secondary">
                                        E-Mail
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="deine@email.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="password" className="text-sm font-medium text-secondary">
                                        Passwort
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            id="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            disabled={loading}
                                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 pr-12 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                                            tabIndex={-1}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <label htmlFor="code" className="text-sm font-medium text-secondary">
                                    2FA-Code
                                </label>
                                <input
                                    type="text"
                                    id="code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    required
                                    disabled={loading}
                                    autoFocus
                                    maxLength={6}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="000000"
                                />
                                <p className="text-xs text-secondary/70">
                                    Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNeeds2FA(false);
                                        setCode("");
                                        setError("");
                                    }}
                                    className="text-sm text-accent hover:underline"
                                >
                                    ← Zurück zum Login
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !isLoaded}
                            className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (needs2FA ? "Wird verifiziert..." : "Wird angemeldet...") : (needs2FA ? "Code verifizieren" : "Anmelden")}
                        </button>
                    </form>
                </div>

                <div className="text-center mt-6 space-y-2">
                    <a
                        href="/admin/signup"
                        className="block text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Noch kein Account? Registrieren →
                    </a>
                    <a
                        href="/"
                        className="block text-sm text-secondary hover:text-accent transition-colors"
                    >
                        ← Zurück zur Hauptseite
                    </a>
                </div>
            </motion.div>
        </div>
    );
}
