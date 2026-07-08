"use client";

import { useState } from "react";
import { usePaginatedQuery, useQuery, useMutation, useAction } from "convex/react";
import { Trash2, UserPlus, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type CommissionType = "percentage" | "fixed";

interface AffiliateEditModalProps {
    userId: Id<"users">;
    onClose: () => void;
}

function AffiliateEditModal({ userId, onClose }: AffiliateEditModalProps) {
    const profile = useQuery(api.affiliate_profiles.queries.getByUserId, { userId });
    const updateProfile = useMutation(api.affiliate_profiles.mutations.update);

    const [code, setCode] = useState<string | null>(null);
    const [commissionType, setCommissionType] = useState<CommissionType | null>(null);
    const [commissionAmount, setCommissionAmount] = useState<string | null>(null);
    const [isActive, setIsActive] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);

    // Init state from loaded profile (once)
    if (profile && code === null) {
        setCode(profile.affiliateCode);
        setCommissionType(profile.commissionType);
        setCommissionAmount(profile.commissionAmount.toString());
        setIsActive(profile.isActive);
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile || code === null || commissionType === null || commissionAmount === null || isActive === null) return;
        setSaving(true);
        try {
            await updateProfile({
                profileId: profile._id,
                affiliateCode: code.trim(),
                commissionType,
                commissionAmount: parseFloat(commissionAmount),
                isActive,
            });
            toast.success("Affiliate-Profil gespeichert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Affiliate bearbeiten</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {!profile ? (
                    <div className="flex items-center gap-2 text-secondary text-sm py-4">
                        <Loader2 size={14} className="animate-spin" /> Wird geladen…
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">Affiliate-Code</label>
                            <input
                                type="text"
                                value={code ?? ""}
                                onChange={(e) => setCode(e.target.value)}
                                required
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-secondary">Provisionstyp</label>
                                <select
                                    value={commissionType ?? "percentage"}
                                    onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                                    disabled={saving}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                                >
                                    <option value="percentage">Prozent (%)</option>
                                    <option value="fixed">Fest ($)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-secondary">
                                    Betrag {commissionType === "percentage" ? "(%)" : "($)"}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={commissionAmount ?? ""}
                                    onChange={(e) => setCommissionAmount(e.target.value)}
                                    required
                                    disabled={saving}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsActive((v) => !v)}
                                disabled={saving}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${isActive ? "bg-accent" : "bg-border"}`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                            <span className="text-sm text-secondary">
                                {isActive ? "Aktiv" : "Inaktiv"}
                            </span>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 py-3 border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Wird gespeichert…" : "Speichern"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

interface SupportUserRowProps {
    userId: Id<"users">;
    email: string;
    onManage: () => void;
}

function SupportUserRow({ userId, email, onManage }: SupportUserRowProps) {
    const assignedApps = useQuery(api.user_app_assignments.queries.getAppsForUser, { userId });

    return (
        <tr className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
            <td className="px-4 py-3 text-primary">{email}</td>
            <td className="px-4 py-3">
                {assignedApps === undefined ? (
                    <Loader2 size={12} className="animate-spin text-secondary" />
                ) : assignedApps.length === 0 ? (
                    <span className="text-secondary text-xs">Keine Apps</span>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {assignedApps.map((app: any) => app && (
                            <span
                                key={app._id}
                                className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400"
                            >
                                {app.name}
                            </span>
                        ))}
                    </div>
                )}
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    onClick={onManage}
                    className="text-secondary hover:text-accent transition-colors p-1"
                    title="Apps verwalten"
                >
                    <Pencil size={16} />
                </button>
            </td>
        </tr>
    );
}

interface SupportAppsModalProps {
    userId: Id<"users">;
    onClose: () => void;
}

function SupportAppsModal({ userId, onClose }: SupportAppsModalProps) {
    const allApps = useQuery(api.apps.queries.getAll);
    const assignedApps = useQuery(api.user_app_assignments.queries.getAppsForUser, { userId });
    const assignMutation = useMutation(api.user_app_assignments.mutations.assign);
    const unassignMutation = useMutation(api.user_app_assignments.mutations.unassign);

    const [saving, setSaving] = useState(false);
    // Local selection state: null means "not yet initialised from server"
    const [selected, setSelected] = useState<Set<string> | null>(null);

    // Initialise once assigned apps are loaded
    if (assignedApps !== undefined && selected === null) {
        setSelected(new Set(assignedApps.map((a: any) => a!._id)));
    }

    const toggle = (appId: string) => {
        setSelected((prev) => {
            if (!prev) return prev;
            const next = new Set(prev);
            if (next.has(appId)) next.delete(appId);
            else next.add(appId);
            return next;
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allApps || !assignedApps || !selected) return;
        setSaving(true);
        try {
            const previousIds = new Set(assignedApps.map((a: any) => a!._id));
            const toAssign = [...selected].filter((id) => !previousIds.has(id as Id<"apps">));
            const toUnassign = [...previousIds].filter((id: unknown) => !selected.has(id as string));

            await Promise.all([
                ...toAssign.map((appId) => assignMutation({ userId, appId: appId as Id<"apps"> })),
                ...toUnassign.map((appId) => unassignMutation({ userId, appId: appId as Id<"apps"> })),
            ]);
            toast.success("App-Zuweisungen gespeichert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    const isLoading = allApps === undefined || assignedApps === undefined || selected === null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Apps verwalten</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 text-secondary text-sm py-4">
                        <Loader2 size={14} className="animate-spin" /> Wird geladen…
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4">
                        {allApps.length === 0 ? (
                            <p className="text-secondary text-sm">Keine Apps vorhanden.</p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {allApps.map((app) => (
                                    <label
                                        key={app._id}
                                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface2/80 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected?.has(app._id) ?? false}
                                            onChange={() => toggle(app._id)}
                                            disabled={saving}
                                            className="accent-accent w-4 h-4"
                                        />
                                        <span className="text-sm text-primary">{app.name}</span>
                                        <span className="text-xs text-secondary font-mono ml-auto">{app.slug}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 py-3 border border-border rounded-xl text-secondary hover:text-primary hover:border-accent/50 transition-all disabled:opacity-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                type="submit"
                                disabled={saving || allApps.length === 0}
                                className="flex-1 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? "Wird gespeichert…" : "Speichern"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function UsersPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.type === "admin";

    const { results: users, status, loadMore } = usePaginatedQuery(
        api.users.queries.getAllUsersPaginated,
        isAdmin ? {} : "skip",
        { initialNumItems: 20 }
    );
    const invites = useQuery(api.user_invites.queries.getAll, isAdmin ? {} : "skip");
    const createAndSend = useAction(api.user_invites.actions.createAndSend);
    const removeInvite = useMutation(api.user_invites.mutations.remove);

    const allApps = useQuery(api.apps.queries.getAll, isAdmin ? {} : "skip");

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<"admin" | "creator" | "affiliate" | "support">("creator");
    const [inviteAffiliateCode, setInviteAffiliateCode] = useState("");
    const [inviteCommissionType, setInviteCommissionType] = useState<CommissionType>("percentage");
    const [inviteCommissionAmount, setInviteCommissionAmount] = useState("10");
    const [inviteAppIds, setInviteAppIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    const [editingUserId, setEditingUserId] = useState<Id<"users"> | null>(null);
    const [managingAppsForUserId, setManagingAppsForUserId] = useState<Id<"users"> | null>(null);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await createAndSend({
                email: inviteEmail,
                role: inviteRole,
                affiliateCode: inviteRole === "affiliate" ? inviteAffiliateCode : undefined,
                commissionType: inviteRole === "affiliate" ? inviteCommissionType : undefined,
                commissionAmount: inviteRole === "affiliate" ? parseFloat(inviteCommissionAmount) : undefined,
                appIds: inviteRole === "support" && inviteAppIds.size > 0
                    ? ([...inviteAppIds] as Id<"apps">[])
                    : undefined,
            });
            setInviteEmail("");
            setInviteAffiliateCode("");
            setInviteCommissionAmount("10");
            setInviteCommissionType("percentage");
            setInviteAppIds(new Set());
            if (result.emailSent) {
                toast.success(`Einladung an ${inviteEmail} gesendet.`);
            } else {
                toast.success(`Einladung für ${inviteEmail} erstellt. (E-Mail konnte nicht gesendet werden.)`);
            }
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
                <form onSubmit={handleInvite} className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
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
                            onChange={(e) => {
                                setInviteRole(e.target.value as "admin" | "creator" | "affiliate" | "support");
                                setInviteAffiliateCode("");
                                setInviteCommissionAmount("10");
                                setInviteCommissionType("percentage");
                                setInviteAppIds(new Set());
                            }}
                            disabled={loading}
                            className="bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                        >
                            <option value="creator">Creator</option>
                            <option value="admin">Admin</option>
                            <option value="affiliate">Affiliate</option>
                            <option value="support">Support</option>
                        </select>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Wird eingeladen…" : "Einladen"}
                        </button>
                    </div>

                    {inviteRole === "support" && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-secondary">App-Zugriff</p>
                            {!allApps ? (
                                <div className="flex items-center gap-2 text-secondary text-xs">
                                    <Loader2 size={12} className="animate-spin" /> Wird geladen…
                                </div>
                            ) : allApps.length === 0 ? (
                                <p className="text-secondary text-xs">Keine Apps vorhanden.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {allApps.map((app) => {
                                        const selected = inviteAppIds.has(app._id);
                                        return (
                                            <button
                                                key={app._id}
                                                type="button"
                                                disabled={loading}
                                                onClick={() =>
                                                    setInviteAppIds((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(app._id)) next.delete(app._id);
                                                        else next.add(app._id);
                                                        return next;
                                                    })
                                                }
                                                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all disabled:opacity-50 ${
                                                    selected
                                                        ? "bg-accent/10 border-accent text-accent"
                                                        : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                                                }`}
                                            >
                                                {app.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {inviteRole === "affiliate" && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={inviteAffiliateCode}
                                onChange={(e) => setInviteAffiliateCode(e.target.value)}
                                required
                                placeholder="Affiliate-Code (z.B. johndoe)"
                                disabled={loading}
                                className="flex-1 bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                            <select
                                value={inviteCommissionType}
                                onChange={(e) => setInviteCommissionType(e.target.value as CommissionType)}
                                disabled={loading}
                                className="bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                            >
                                <option value="percentage">Prozent (%)</option>
                                <option value="fixed">Fest ($)</option>
                            </select>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={inviteCommissionAmount}
                                onChange={(e) => setInviteCommissionAmount(e.target.value)}
                                required
                                placeholder={inviteCommissionType === "percentage" ? "10" : "5.00"}
                                disabled={loading}
                                className="w-28 bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                        </div>
                    )}
                </form>
            </section>

            {/* Open Invites */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Einladungen</h2>
                {(() => {
                    const openInvites = invites?.filter((i: { usedAt?: number }) => i.usedAt === undefined) ?? [];
                    return !invites || openInvites.length === 0 ? (
                        <p className="text-secondary text-sm">Keine offenen Einladungen vorhanden.</p>
                    ) : (
                        <div className="border border-border rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-surface2/30">
                                        <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                        <th className="text-left px-4 py-3 text-secondary font-medium">Rolle</th>
                                        <th className="text-left px-4 py-3 text-secondary font-medium">Eingeladen am</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {openInvites.map((invite: {
                                        _id: Id<"user_invites">;
                                        email: string;
                                        role: "admin" | "creator" | "affiliate" | "support";
                                        affiliateCode?: string;
                                        commissionType?: CommissionType;
                                        commissionAmount?: number;
                                        appIds?: Id<"apps">[];
                                        createdAt: number;
                                    }) => (
                                        <tr key={invite._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                            <td className="px-4 py-3 text-primary">{invite.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                    invite.role === "admin"
                                                        ? "bg-accent/20 text-accent"
                                                        : invite.role === "affiliate"
                                                        ? "bg-purple-500/20 text-purple-400"
                                                        : invite.role === "support"
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-blue-500/20 text-blue-400"
                                                }`}>
                                                    {invite.role === "admin" ? "Admin" : invite.role === "affiliate" ? "Affiliate" : invite.role === "support" ? "Support" : "Creator"}
                                                </span>
                                                {invite.role === "affiliate" && (
                                                    <span className="ml-2 text-xs text-secondary font-mono">{invite.affiliateCode}</span>
                                                )}
                                                {invite.role === "affiliate" && invite.commissionAmount !== undefined && (
                                                    <span className="ml-2 text-xs text-secondary">
                                                        {invite.commissionType === "percentage"
                                                            ? `${invite.commissionAmount}%`
                                                            : `$${invite.commissionAmount}`}
                                                    </span>
                                                )}
                                                {invite.role === "support" && invite.appIds && invite.appIds.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {invite.appIds.map((appId) => {
                                                            const app = allApps?.find((a) => a._id === appId);
                                                            return app ? (
                                                                <span key={appId} className="text-xs px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-400">
                                                                    {app.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-secondary">{formatDate(invite.createdAt)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleRevoke(invite._id)}
                                                    className="text-secondary hover:text-red-400 transition-colors p-1"
                                                    title="Einladung löschen"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}
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
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => (
                                        <tr key={u._id} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                            <td className="px-4 py-3 text-primary">{u.email ?? "—"}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                    u.type === "admin"
                                                        ? "bg-accent/20 text-accent"
                                                        : u.type === "affiliate"
                                                        ? "bg-purple-500/20 text-purple-400"
                                                        : u.type === "support"
                                                        ? "bg-green-500/20 text-green-400"
                                                        : "bg-blue-500/20 text-blue-400"
                                                }`}>
                                                    {u.type === "admin" ? "Admin" : u.type === "affiliate" ? "Affiliate" : u.type === "support" ? "Support" : "Creator"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-secondary">{formatDate(u.createdAt)}</td>
                                            <td className="px-4 py-3 text-right">
                                                {u.type === "affiliate" && (
                                                    <button
                                                        onClick={() => setEditingUserId(u._id)}
                                                        className="text-secondary hover:text-accent transition-colors p-1"
                                                        title="Affiliate bearbeiten"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                )}
                                            </td>
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
                                Load more
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

            {/* Support Users */}
            <section>
                <h2 className="text-xl font-semibold mb-4">Support Users</h2>
                {(() => {
                    const supportUsers = users.filter((u) => u.type === "support");
                    return supportUsers.length === 0 ? (
                        <p className="text-secondary text-sm">Keine Support-User vorhanden.</p>
                    ) : (
                        <div className="border border-border rounded-2xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-surface2/30">
                                        <th className="text-left px-4 py-3 text-secondary font-medium">E-Mail</th>
                                        <th className="text-left px-4 py-3 text-secondary font-medium">Zugewiesene Apps</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {supportUsers.map((u) => (
                                        <SupportUserRow
                                            key={u._id}
                                            userId={u._id}
                                            email={u.email ?? "—"}
                                            onManage={() => setManagingAppsForUserId(u._id)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}
            </section>

            {editingUserId && (
                <AffiliateEditModal
                    userId={editingUserId}
                    onClose={() => setEditingUserId(null)}
                />
            )}
            {managingAppsForUserId && (
                <SupportAppsModal
                    userId={managingAppsForUserId}
                    onClose={() => setManagingAppsForUserId(null)}
                />
            )}
        </div>
    );
}
