"use client";

import { useState, useEffect, Suspense } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";

function AdminSignUpPage() {
    const { signUp, setActive, isLoaded } = useSignUp();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tokenFromUrl = searchParams.get("token");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [pendingVerification, setPendingVerification] = useState(false);
    const [pendingInvite, setPendingInvite] = useState<{
        inviteId: Id<"user_invites">;
        name?: string;
        lastName?: string;
    } | null>(null);
    const { isAuthenticated } = useConvexAuth();

    // Token path: used when arriving via magic link
    const inviteByToken = useQuery(
        api.user_invites.queries.getByToken,
        tokenFromUrl ? { token: tokenFromUrl } : "skip"
    );

    // Email path: existing behavior, skip if a token is already in the URL
    const inviteByEmail = useQuery(
        api.user_invites.queries.getOpenInviteByEmail,
        !tokenFromUrl && email.length > 3 ? { email } : "skip"
    );

    // Unified invite reference — handleSubmit logic stays unchanged
    const invite = tokenFromUrl ? inviteByToken : inviteByEmail;

    // Pre-fill email when arriving via magic link
    useEffect(() => {
        if (inviteByToken) {
            setEmail(inviteByToken.email);
        }
    }, [inviteByToken]);

    const createUserFromInvite = useMutation(api.users.mutations.createUserFromInvite);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signUp) return;
        setError("");

        // invite === undefined means query is still loading; null means no invite found
        if (invite === null) {
            setError("Du wurdest nicht eingeladen. Bitte wende dich an einen Admin.");
            return;
        }
        if (invite === undefined) {
            setError("Einladung wird geprüft…");
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
            await signUp.create({
                emailAddress: email,
                password,
                firstName,
                lastName,
            });

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });

            setPendingVerification(true);
        } catch (err: unknown) {
            if (err && typeof err === "object" && "errors" in err) {
                const clerkError = err as { errors: Array<{ message: string }> };
                setError(clerkError.errors[0]?.message || "Registrierung fehlgeschlagen.");
            } else {
                setError("Registrierung fehlgeschlagen.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded || !signUp) return;
        setError("");
        setLoading(true);

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: verificationCode,
            });

            if (result.status === "complete") {
                await setActive!({ session: result.createdSessionId });
                // Der Convex-Client bekommt das Clerk-Token erst asynchron nach setActive.
                // createUserFromInvite hier direkt aufzurufen ist eine Race Condition
                // (Mutation kam teils unauthentifiziert an) — stattdessen im Effekt unten
                // feuern, sobald Convex die Session kennt. Loading bleibt bis dahin aktiv.
                setPendingInvite({
                    inviteId: invite!._id,
                    name: firstName || undefined,
                    lastName: lastName || undefined,
                });
                return;
            }
            setLoading(false);
        } catch (err: unknown) {
            if (err && typeof err === "object" && "errors" in err) {
                const clerkError = err as { errors: Array<{ message: string }> };
                setError(clerkError.errors[0]?.message || "Verifizierung fehlgeschlagen.");
            } else {
                setError("Verifizierung fehlgeschlagen.");
            }
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!pendingInvite || !isAuthenticated) return;
        const inviteArgs = pendingInvite;
        setPendingInvite(null);
        (async () => {
            try {
                await createUserFromInvite(inviteArgs);
                router.push("/admin");
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Registrierung konnte nicht abgeschlossen werden.");
                setLoading(false);
            }
        })();
    }, [pendingInvite, isAuthenticated, createUserFromInvite, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Registrierung</h1>
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
                                    onChange={(e) => !tokenFromUrl && setEmail(e.target.value)}
                                    readOnly={!!tokenFromUrl}
                                    required
                                    disabled={loading}
                                    className={`w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50 ${tokenFromUrl ? "opacity-70 cursor-default" : ""}`}
                                    placeholder="deine@email.com"
                                />
                                {/* Token path feedback */}
                                {tokenFromUrl && inviteByToken === null && (
                                    <p className="text-xs text-red-400">Dieser Einladungslink ist ungültig oder wurde bereits verwendet.</p>
                                )}
                                {tokenFromUrl && inviteByToken && (
                                    <p className="text-xs text-green-400">Einladung gefunden — Rolle: {inviteByToken.role}</p>
                                )}
                                {/* Email path feedback */}
                                {!tokenFromUrl && email.length > 3 && inviteByEmail === null && (
                                    <p className="text-xs text-red-400">Keine Einladung für diese E-Mail gefunden.</p>
                                )}
                                {!tokenFromUrl && email.length > 3 && inviteByEmail && (
                                    <p className="text-xs text-green-400">Einladung gefunden — Rolle: {inviteByEmail.role}</p>
                                )}
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
                                <p className="text-xs text-secondary/70">Mindestens 8 Zeichen</p>
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
                                disabled={loading || !isLoaded}
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
                                disabled={loading || !isLoaded}
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

export default function AdminSignUpPageWrapper() {
    return (
        <Suspense fallback={null}>
            <AdminSignUpPage />
        </Suspense>
    );
}
