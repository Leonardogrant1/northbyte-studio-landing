"use client";

import { useMemo, useState } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { DateRangePicker } from "@/components/admin/DateRangePicker";

type CommissionType = "percentage" | "fixed" | "flat";

interface AffiliateRow {
    profileId: Id<"affiliate_profiles">;
    name: string;
    email: string | null;
    affiliateCode: string;
    commissionType: CommissionType;
    commissionAmount: number;
    isActive: boolean;
    isStandalone: boolean;
    stats: {
        earned: number | null;
        revenue: number;
        proceeds: number;
        net: number;
        linkViews: number;
        storeClicks: number;
        clickThroughRate: number;
        referredUsers: number;
        convertedUsers: number;
        conversionRate: number;
        cancelRate: number;
        refundRate: number;
    };
}

function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToStartOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function isoToEndOfDayMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatUsd(amount: number) {
    return `$${amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
}

function formatAmount(type: CommissionType, amount: number) {
    if (type === "percentage") return `${amount}%`;
    return `$${amount}`;
}

function typeLabel(type: CommissionType) {
    if (type === "percentage") return "Provision (%)";
    if (type === "fixed") return "Fix pro Conversion";
    return "Pauschale";
}

function CreateFlatDialog({ onClose }: { onClose: () => void }) {
    const createStandalone = useMutation(api.affiliate_profiles.mutations.createStandalone);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [amount, setAmount] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await createStandalone({
                name: name.trim(),
                affiliateCode: code.trim(),
                commissionAmount: parseFloat(amount || "0"),
            });
            toast.success("Flat-Affiliate angelegt.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Anlegen.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface2 border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Flat-Affiliate anlegen</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            placeholder="z.B. Max Mustermann"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Affiliate-Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            placeholder="z.B. maxpromo"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Deal-Betrag ($)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            placeholder="500"
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
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
                            {saving ? "Wird angelegt…" : "Anlegen"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function EditAffiliateDialog({ row, onClose }: { row: AffiliateRow; onClose: () => void }) {
    const updateProfile = useMutation(api.affiliate_profiles.mutations.update);
    const [name, setName] = useState(row.name === "—" ? "" : row.name);
    const [code, setCode] = useState(row.affiliateCode);
    const [commissionType, setCommissionType] = useState<CommissionType>(row.commissionType);
    const [amount, setAmount] = useState(row.commissionAmount.toString());
    const [isActive, setIsActive] = useState(row.isActive);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateProfile({
                profileId: row.profileId,
                affiliateCode: code.trim(),
                commissionType,
                commissionAmount: parseFloat(amount || "0"),
                isActive,
                name: row.isStandalone ? name.trim() : undefined,
            });
            toast.success("Affiliate gespeichert.");
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
                <form onSubmit={handleSubmit} className="space-y-4">
                    {row.isStandalone && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                            />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-secondary">Affiliate-Code</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            required
                            disabled={saving}
                            className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-secondary">Typ</label>
                            <select
                                value={commissionType}
                                onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                                disabled={saving}
                                className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-accent transition-all disabled:opacity-50"
                            >
                                <option value="percentage">Prozent (%)</option>
                                <option value="fixed">Fix pro Conversion ($)</option>
                                <option value="flat">Pauschale ($)</option>
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
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
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
                        <span className="text-sm text-secondary">{isActive ? "Aktiv" : "Inaktiv"}</span>
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
            </div>
        </div>
    );
}

export default function AffiliatesAdminPage() {
    const { isAuthenticated } = useConvexAuth();

    const today = todayIso();
    const defaultFrom = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(today);
    const [environment, setEnvironment] = useState<"PRODUCTION" | "SANDBOX">("PRODUCTION");

    const fromMs = useMemo(() => isoToStartOfDayMs(from), [from]);
    const toMs = useMemo(() => isoToEndOfDayMs(to), [to]);

    const rows = useQuery(
        api.affiliate_profiles.queries.getAllWithStats,
        isAuthenticated ? { fromMs, toMs, environment } : "skip",
    );

    const removeStandalone = useMutation(api.affiliate_profiles.mutations.removeStandalone);

    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState<AffiliateRow | null>(null);

    const handleDelete = async (row: AffiliateRow) => {
        if (!window.confirm(`Flat-Affiliate "${row.name}" wirklich löschen?`)) return;
        try {
            await removeStandalone({ profileId: row.profileId });
            toast.success("Flat-Affiliate gelöscht.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Löschen.");
        }
    };

    return (
        <div className="max-w-[1600px] space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Affiliates</h1>
                    <p className="text-secondary">Alle Affiliates und ihre Performance im Überblick.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setEnvironment((e) => (e === "PRODUCTION" ? "SANDBOX" : "PRODUCTION"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${environment === "SANDBOX"
                            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                            : "border-border text-secondary hover:border-accent/50"
                            }`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${environment === "SANDBOX" ? "bg-yellow-400" : "bg-green-400"}`} />
                        {environment === "SANDBOX" ? "Sandbox" : "Production"}
                    </button>
                    <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
                    <button
                        onClick={() => setCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                    >
                        <Plus size={16} />
                        Flat-Affiliate anlegen
                    </button>
                </div>
            </div>

            {rows === undefined ? (
                <div className="flex items-center gap-2 text-secondary text-sm">
                    <Loader2 size={14} className="animate-spin" /> Wird geladen…
                </div>
            ) : rows === null ? (
                <p className="text-secondary text-sm">Kein Zugriff.</p>
            ) : rows.length === 0 ? (
                <p className="text-secondary text-sm">Keine Affiliates vorhanden.</p>
            ) : (
                <div className="border border-border rounded-2xl overflow-x-auto">
                    <table className="w-full text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-border bg-surface2/30">
                                <th className="text-left px-4 py-3 text-secondary font-medium">Name</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Code</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Typ</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Betrag</th>
                                <th className="text-left px-4 py-3 text-secondary font-medium">Status</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Views</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Store-Klicks</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">CTR</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Referred</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Converted</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Conv-Rate</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Cancel</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Refund</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Earned</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Umsatz</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Proceeds</th>
                                <th className="text-right px-4 py-3 text-secondary font-medium">Netto</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {(rows as AffiliateRow[]).map((row) => (
                                <tr key={row.profileId} className="border-b border-border last:border-0 hover:bg-surface2/20 transition-colors">
                                    <td className="px-4 py-3 text-primary">
                                        {row.name}
                                        {row.email && <span className="block text-xs text-secondary">{row.email}</span>}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-primary">{row.affiliateCode}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${row.commissionType === "flat"
                                            ? "bg-orange-500/20 text-orange-400"
                                            : "bg-purple-500/20 text-purple-400"
                                            }`}>
                                            {typeLabel(row.commissionType)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary">{formatAmount(row.commissionType, row.commissionAmount)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${row.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                            {row.isActive ? "Aktiv" : "Inaktiv"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.linkViews}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.storeClicks}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.clickThroughRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.referredUsers}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.convertedUsers}</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.conversionRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.cancelRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">{row.stats.refundRate.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right text-primary">
                                        {row.stats.earned !== null ? formatUsd(row.stats.earned) : "—"}
                                    </td>
                                    <td className="px-4 py-3 text-right text-primary">{formatUsd(row.stats.revenue)}</td>
                                    <td className="px-4 py-3 text-right text-primary">{formatUsd(row.stats.proceeds)}</td>
                                    <td className={`px-4 py-3 text-right font-medium ${row.stats.net < 0 ? "text-red-400" : "text-primary"}`}>
                                        {formatUsd(row.stats.net)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setEditing(row)}
                                            className="text-secondary hover:text-accent transition-colors p-1"
                                            title="Bearbeiten"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        {row.isStandalone && (
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="text-secondary hover:text-red-400 transition-colors p-1"
                                                title="Löschen"
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

            {creating && <CreateFlatDialog onClose={() => setCreating(false)} />}
            {editing && <EditAffiliateDialog row={editing} onClose={() => setEditing(null)} />}
        </div>
    );
}
