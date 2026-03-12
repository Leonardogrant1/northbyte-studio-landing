"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { isNorthByteEmail } from "@/lib/auth-utils";

export default function AdminSignUpPage() {
    const { signUp, fetchStatus } = useSignUp();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(false);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fetchStatus === "fetching") return;
        setError("");

        if (!isNorthByteEmail(email)) {
            setError("Nur @northbyte.studio E-Mail-Adressen sind erlaubt.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwörter stimmen nicht überein.");
            return;
        }
        if (password.length < 8) {
            setError("Passwort muss mindestens 8 Zeichen lang sein.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await signUp.password({
                emailAddress: email,
                password,
                firstName,
                lastName,
            });

            if (error) {
                setError(error.message);
                return;
            }

            // Email Code schicken
            const { error: sendError } = await signUp.verifications.sendEmailCode();
            if (sendError) {
                setError(sendError.message);
                return;
            }

            setPendingVerification(true);
        } catch (err) {
            setError("Registrierung fehlgeschlagen.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fetchStatus === "fetching") return;
        setError("");
        setLoading(true);

        try {
            const { error } = await signUp.verifications.verifyEmailCode({
                code: verificationCode,
            });

            if (error) {
                setError(error.message);
                return;
            }

            // Nur finalize wenn status complete
            if (signUp.status === "complete") {
                await signUp.finalize();
                router.push("/admin");
            }
        } catch (err) {
            setError("Verifizierung fehlgeschlagen.");
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
                    <h1 className="text-4xl font-bold mb-2">Admin Registrierung</h1>
                    <p className="text-secondary">NorthByte Studio Dashboard</p>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-2xl">
                    {!pendingVerification ? (
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="firstName" className="text-sm font-medium text-secondary">
                                        Vorname
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Max"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="lastName" className="text-sm font-medium text-secondary">
                                        Nachname
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        required
                                        disabled={loading}
                                        className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                        placeholder="Mustermann"
                                    />
                                </div>
                            </div>

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
                                    placeholder="admin@northbyte.studio"
                                />
                                <p className="text-xs text-secondary/70">
                                    Nur @northbyte.studio E-Mails
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium text-secondary">
                                    Passwort
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                                <p className="text-xs text-secondary/70">
                                    Mindestens 8 Zeichen
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmPassword" className="text-sm font-medium text-secondary">
                                    Passwort bestätigen
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="••••••••"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || fetchStatus == "fetching"}
                                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Wird registriert..." : "Registrieren"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerification} className="space-y-6">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm"
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="text-center mb-6">
                                <p className="text-secondary">
                                    Wir haben einen Verifizierungscode an <strong className="text-primary">{email}</strong> gesendet.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="code" className="text-sm font-medium text-secondary">
                                    Verifizierungscode
                                </label>
                                <input
                                    type="text"
                                    id="code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    required
                                    disabled={loading}
                                    autoFocus
                                    maxLength={6}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary text-center text-2xl tracking-widest font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                    placeholder="000000"
                                />
                                <p className="text-xs text-secondary/70">
                                    Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || fetchStatus == "fetching"}
                                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-white hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Wird verifiziert..." : "Verifizieren"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setPendingVerification(false);
                                    setVerificationCode("");
                                    setError("");
                                }}
                                className="w-full text-sm text-accent hover:underline"
                            >
                                ← Zurück zur Registrierung
                            </button>
                        </form>
                    )}
                </div>

                <div className="text-center mt-6 space-y-2">
                    <a
                        href="/admin/login"
                        className="block text-sm text-secondary hover:text-accent transition-colors"
                    >
                        Bereits registriert? Zum Login →
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
