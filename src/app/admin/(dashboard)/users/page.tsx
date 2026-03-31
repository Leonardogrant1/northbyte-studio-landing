"use client";

import { useState } from "react";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function UsersPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.type === "admin";

    const { results: users, status, loadMore } = usePaginatedQuery(
        api.users.queries.getAllUsersPaginated,
        isAdmin ? {} : "skip",
        { initialNumItems: 20 }
    );
    const invites = useQuery(api.user_invites.queries.getAll);
    const createInvite = useMutation(api.user_invites.mutations.create);
    const removeInvite = useMutation(api.user_invites.mutations.remove);

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"admin" | "creator">("creator");
    const [loading, setLoading] = useState(false);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createInvite({ email: inviteEmail, role: inviteRole });
            setInviteEmail("");
            toast.success(`Einladung für ${inviteEmail} erstellt.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Einladen.");
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (inviteId: Id<"user_invites">) => {
        try {
            await removeInvite({ inviteId });
            toast.success("Einladung widerrufen.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Widerrufen.");
        }
    };

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

    return (
        <div className="max-w-4xl space-y-10">
            <div>
                <h1 className="text-3xl font-bold mb-1">User & Roles</h1>
                <p className="text-secondary">Benutzer einladen und Rollen verwalten.</p>
            </div>

            {/* Invite Form */}
            <section className="bg-surface2/50 border border-border rounded-2xl p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <UserPlus size={20} />
                    Benutzer einladen
                </h2>
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                        placeholder="email@beispiel.com"
                        disabled={loading}
                        className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                    />
                    <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as "admin" | "creator")}
                        disabled={loading}
                        className="bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                    >
                        <option value="creator">Creator</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Wird eingeladen…" : "Einladen"}
                    </button>
                </form>
            </section>

            {/* Open Invites */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Einladungen</h2>
                {!invites || invites.length === 0 ? (
                    <p className="text-secondary text-sm">Keine Einladungen vorhanden.</p>
                ) : (
                    <div className="border border-border rounded-2xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface2/30">
                                    <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Rolle</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Eingeladen am</th>
                                    <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {invites.map((invite: { _id: Id<"user_invites">; email: string; role: "admin" | "creator"; createdAt: number; usedAt?: number }) => (
                                    <tr key={invite._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                        <td className="px-4 py-3 text-primary">{invite.email}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${invite.role === "admin"
                                                    ? "bg-accent/20 text-accent"
                                                    : "bg-blue-500/20 text-blue-400"
                                                }`}>
                                                {invite.role === "admin" ? "Admin" : "Creator"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-secondary">{formatDate(invite.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${invite.usedAt
                                                    ? "bg-green-500/20 text-green-400"
                                                    : "bg-yellow-500/20 text-yellow-400"
                                                }`}>
                                                {invite.usedAt ? "Eingelöst" : "Offen"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!invite.usedAt && (
                                                <button
                                                    onClick={() => handleRevoke(invite._id)}
                                                    className="text-secondary hover:text-red-400 transition-colors p-1"
                                                    title="Einladung widerrufen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Active Users */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Aktive Benutzer</h2>
                {status === "LoadingFirstPage" ? (
                    <div className="flex items-center gap-2 text-secondary text-sm">
                        <Loader2 size={14} className="animate-spin" /> Wird geladen…
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-secondary text-sm">Keine Benutzer vorhanden.</p>
                ) : (
                    <div className="space-y-3">
                        <div className="border border-border rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-surface2/30">
                                        <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                        <th className="text-left px-4 py-3 text-secondary font-medium">Rolle</th>
                                        <th className="text-left px-4 py-3 text-secondary font-medium">Registriert am</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                            <td className="px-4 py-3 text-primary">{u.email ?? "—"}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${u.type === "admin"
                                                        ? "bg-accent/20 text-accent"
                                                        : "bg-blue-500/20 text-blue-400"
                                                    }`}>
                                                    {u.type === "admin" ? "Admin" : "Creator"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-secondary">{formatDate(u.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {status === "CanLoadMore" && (
                            <button
                                onClick={() => loadMore(20)}
                                className="w-full py-2.5 text-sm text-secondary border border-border rounded-xl hover:border-accent/50 hover:text-primary transition-all"
                            >
                                Mehr laden
                            </button>
                        )}
                        {status === "LoadingMore" && (
                            <div className="flex items-center justify-center gap-2 text-secondary text-sm py-2">
                                <Loader2 size={14} className="animate-spin" /> Wird geladen…
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
