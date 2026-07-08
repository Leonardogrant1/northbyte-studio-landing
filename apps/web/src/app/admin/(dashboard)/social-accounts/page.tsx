"use client";

import { useState } from "react";
import { X, Plus, Loader2, Users, Bot, Pencil, Trash2, Clock, Globe, Instagram } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { toast } from "sonner";

const WEBHOOK_URL = "https://n8n.srv1094620.hstgr.cloud/webhook/cd0e02eb-eefc-4b56-8712-ab2c892bba95";

type SocialAccount = {
    _id: Id<"social_accounts">;
    platform: "instagram" | "tiktok";
    isAI: boolean;
    username: string;
    platformId?: string;
    postizId?: string;
    timezone?: string;
    postingTimes?: string[];
    bio?: string;
    followers?: number;
    following?: number;
    likes?: number;
    profileImageUrl?: string;
    assignedTo?: Id<"users">;
    avatarId?: Id<"ai_avatars">;
    createdAt: number;
};

interface AccountPreview {
    platform_id: string;
    username: string;
    verified: boolean;
    bio: string;
    followers: number;
    following: number;
    likes: number;
    avatarUrl: string;
}

const inputClass = "w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50";

// ── Shared modal shell ─────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-surface2/95 border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors"><X size={20} /></button>
                </div>
                {children}
            </motion.div>
        </motion.div>
    );
}

// ── Add Account Modal ──────────────────────────────────────────────────────────

function AddAccountModal({ onClose }: { onClose: () => void }) {
    const avatars = useQuery(api.ai_avatars.queries.getAll);
    const createAccount = useMutation(api.social_accounts.mutations.create);

    const [platform, setPlatform] = useState<"instagram" | "tiktok">("tiktok");
    const [username, setUsername] = useState("");
    const [isAI, setIsAI] = useState(false);
    const [avatarId, setAvatarId] = useState<Id<"ai_avatars"> | "">("");
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<AccountPreview | null>(null);
    const [saving, setSaving] = useState(false);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) return;
        if (isAI && !avatarId) { toast.error("Bitte einen AI-Avatar auswählen."); return; }

        setLoading(true);
        setPreview(null);
        try {
            const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ platform, username: username.trim() }),
            });
            if (!res.ok) { toast.error("Account nicht gefunden."); return; }
            const data: AccountPreview = await res.json();
            if (!data?.username) { toast.error("Account nicht gefunden."); return; }
            setPreview(data);
        } catch {
            toast.error("Account nicht gefunden.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!preview) return;
        setSaving(true);
        try {
            await createAccount({
                platform, isAI,
                username: preview.username,
                platformId: preview.platform_id,
                bio: preview.bio || undefined,
                followers: preview.followers,
                following: preview.following,
                likes: preview.likes,
                profileImageUrl: preview.avatarUrl || undefined,
                avatarId: avatarId ? (avatarId as Id<"ai_avatars">) : undefined,
            });
            toast.success("Account hinzugefügt.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title="Account hinzufügen" onClose={onClose}>
            <div className="p-5 space-y-4">
                <form onSubmit={handleLookup} className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Platform</label>
                        <select value={platform} onChange={(e) => { setPlatform(e.target.value as "instagram" | "tiktok"); setPreview(null); }} className={inputClass} disabled={loading}>
                            <option value="tiktok">TikTok</option>
                            <option value="instagram">Instagram</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Username</label>
                        <input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setPreview(null); }} placeholder="z.B. username123" required className={inputClass} disabled={loading} />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div onClick={() => { setIsAI((v) => !v); setAvatarId(""); }} className={`w-10 h-6 rounded-full transition-colors relative ${isAI ? "bg-accent" : "bg-surface border border-border"}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isAI ? "left-5" : "left-1"}`} />
                        </div>
                        <span className="text-sm text-primary flex items-center gap-1.5"><Bot size={14} className="text-secondary" />AI Account</span>
                    </label>
                    {isAI && (
                        <div>
                            <label className="text-xs font-medium text-secondary block mb-1">AI Avatar *</label>
                            <select value={avatarId} onChange={(e) => setAvatarId(e.target.value as Id<"ai_avatars"> | "")} className={inputClass} disabled={loading}>
                                <option value="">Avatar auswählen…</option>
                                {avatars?.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                            </select>
                        </div>
                    )}
                    <button type="submit" disabled={loading || !username.trim()} className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                        {loading ? <><Loader2 size={15} className="animate-spin" /> Wird gesucht…</> : "Account suchen"}
                    </button>
                </form>

                {preview && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            {preview.avatarUrl && <img src={preview.avatarUrl} alt={preview.username} className="w-12 h-12 rounded-full object-cover shrink-0" />}
                            <div className="min-w-0">
                                <p className="font-semibold text-primary text-sm flex items-center gap-1.5">
                                    @{preview.username}
                                    {preview.verified && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">✓</span>}
                                </p>
                                <p className="text-xs text-secondary capitalize">{platform}</p>
                            </div>
                        </div>
                        {preview.bio && <p className="text-xs text-secondary leading-relaxed">{preview.bio}</p>}
                        <div className="flex gap-4 text-center">
                            {[{ label: "Follower", value: preview.followers }, { label: "Following", value: preview.following }, { label: "Likes", value: preview.likes }].map(({ label, value }) => (
                                <div key={label} className="flex-1">
                                    <p className="text-sm font-semibold text-primary">{value?.toLocaleString("de-DE") ?? "—"}</p>
                                    <p className="text-xs text-secondary">{label}</p>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleConfirm} disabled={saving} className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                            {saving ? <><Loader2 size={15} className="animate-spin" /> Speichern…</> : "Bestätigen & speichern"}
                        </button>
                    </motion.div>
                )}
            </div>
        </ModalShell>
    );
}

// ── Edit Modal ─────────────────────────────────────────────────────────────────

function EditModal({ account, onClose }: { account: SocialAccount; onClose: () => void }) {
    const avatars = useQuery(api.ai_avatars.queries.getAll);
    const allUsers = useQuery(api.users.queries.getAllUsers);
    const creators = allUsers?.filter((u) => u.type === "creator");
    const updateAccount = useMutation(api.social_accounts.mutations.update);

    const [platform, setPlatform] = useState(account.platform);
    const [username, setUsername] = useState(account.username);
    const [platformId, setPlatformId] = useState(account.platformId ?? "");
    const [postizId, setPostizId] = useState(account.postizId ?? "");
    const [assignedTo, setAssignedTo] = useState<Id<"users"> | "">(account.assignedTo ?? "");
    const [timezone, setTimezone] = useState(account.timezone ?? "");
    const [postingTimes, setPostingTimes] = useState<string[]>(account.postingTimes ?? []);

    const addTime = () => setPostingTimes((t) => [...t, "09:00"]);
    const removeTime = (i: number) => setPostingTimes((t) => t.filter((_, idx) => idx !== i));
    const updateTime = (i: number, val: string) => setPostingTimes((t) => t.map((v, idx) => idx === i ? val : v));
    const [isAI, setIsAI] = useState(account.isAI);
    const [avatarId, setAvatarId] = useState<Id<"ai_avatars"> | "">(account.avatarId ?? "");
    const [bio, setBio] = useState(account.bio ?? "");
    const [followers, setFollowers] = useState(account.followers?.toString() ?? "");
    const [following, setFollowing] = useState(account.following?.toString() ?? "");
    const [likes, setLikes] = useState(account.likes?.toString() ?? "");
    const [profileImageUrl, setProfileImageUrl] = useState(account.profileImageUrl ?? "");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isAI && !avatarId) { toast.error("Bitte einen AI-Avatar auswählen."); return; }
        setSaving(true);
        try {
            await updateAccount({
                id: account._id,
                platform,
                username: username.trim(),
                platformId: platformId.trim() || undefined,
                postizId: postizId.trim() || undefined,
                assignedTo: assignedTo ? (assignedTo as Id<"users">) : undefined,
                timezone: timezone || undefined,
                postingTimes: postingTimes.length > 0 ? postingTimes : undefined,
                isAI,
                bio: bio.trim() || undefined,
                followers: followers ? Number(followers) : undefined,
                following: following ? Number(following) : undefined,
                likes: likes ? Number(likes) : undefined,
                profileImageUrl: profileImageUrl.trim() || undefined,
                avatarId: avatarId ? (avatarId as Id<"ai_avatars">) : undefined,
            });
            toast.success("Account aktualisiert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title="Account bearbeiten" onClose={onClose}>
            <form onSubmit={handleSave} className="p-5 space-y-3">
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Platform</label>
                    <select value={platform} onChange={(e) => setPlatform(e.target.value as "instagram" | "tiktok")} className={inputClass} disabled={saving}>
                        <option value="tiktok">TikTok</option>
                        <option value="instagram">Instagram</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Username</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} disabled={saving} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Platform ID</label>
                        <input type="text" value={platformId} onChange={(e) => setPlatformId(e.target.value)} placeholder="z.B. 74191889854" className={inputClass} disabled={saving} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Postiz ID</label>
                        <input type="text" value={postizId} onChange={(e) => setPostizId(e.target.value)} placeholder="Postiz Account ID" className={inputClass} disabled={saving} />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Zugewiesener Creator</label>
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value as Id<"users"> | "")} className={inputClass} disabled={saving}>
                        <option value="">Kein Creator</option>
                        {creators?.map((u) => (
                            <option key={u._id} value={u._id}>{u.email ?? u._id}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Timezone</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass} disabled={saving}>
                        <option value="">Keine Angabe</option>
                        <optgroup label="Europa">
                            <option value="Europe/Berlin">Europe/Berlin (DE/AT/CH)</option>
                            <option value="Europe/London">Europe/London</option>
                            <option value="Europe/Paris">Europe/Paris</option>
                            <option value="Europe/Rome">Europe/Rome</option>
                            <option value="Europe/Madrid">Europe/Madrid</option>
                        </optgroup>
                        <optgroup label="Amerika">
                            <option value="America/New_York">America/New_York (ET)</option>
                            <option value="America/Chicago">America/Chicago (CT)</option>
                            <option value="America/Denver">America/Denver (MT)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
                            <option value="America/Sao_Paulo">America/Sao_Paulo (BR)</option>
                        </optgroup>
                        <optgroup label="Asien / Pazifik">
                            <option value="Asia/Tokyo">Asia/Tokyo</option>
                            <option value="Asia/Shanghai">Asia/Shanghai</option>
                            <option value="Asia/Dubai">Asia/Dubai</option>
                            <option value="Australia/Sydney">Australia/Sydney</option>
                        </optgroup>
                    </select>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-secondary">Posting Times</label>
                        <button type="button" onClick={addTime} className="text-xs text-accent hover:underline flex items-center gap-1" disabled={saving}>
                            <Plus size={12} /> Zeit hinzufügen
                        </button>
                    </div>
                    {postingTimes.length === 0 ? (
                        <p className="text-xs text-secondary/60 py-2">Noch keine Zeiten gesetzt.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {postingTimes.map((t, i) => (
                                <div key={i} className="flex items-center gap-1 bg-surface border border-border rounded-lg px-2 py-1">
                                    <input
                                        type="time"
                                        value={t}
                                        onChange={(e) => updateTime(i, e.target.value)}
                                        className="bg-transparent text-sm text-primary focus:outline-none w-24"
                                        disabled={saving}
                                    />
                                    <button type="button" onClick={() => removeTime(i)} className="text-secondary hover:text-red-400 transition-colors" disabled={saving}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Bio</label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={inputClass + " resize-none"} disabled={saving} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "Follower", value: followers, set: setFollowers },
                        { label: "Following", value: following, set: setFollowing },
                        { label: "Likes", value: likes, set: setLikes },
                    ].map(({ label, value, set }) => (
                        <div key={label}>
                            <label className="text-xs font-medium text-secondary block mb-1">{label}</label>
                            <input type="number" min="0" value={value} onChange={(e) => set(e.target.value)} className={inputClass} disabled={saving} />
                        </div>
                    ))}
                </div>
                <div>
                    <label className="text-xs font-medium text-secondary block mb-1">Profilbild URL</label>
                    <input type="text" value={profileImageUrl} onChange={(e) => setProfileImageUrl(e.target.value)} className={inputClass} disabled={saving} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div onClick={() => { setIsAI((v) => !v); if (isAI) setAvatarId(""); }} className={`w-10 h-6 rounded-full transition-colors relative ${isAI ? "bg-accent" : "bg-surface border border-border"}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isAI ? "left-5" : "left-1"}`} />
                    </div>
                    <span className="text-sm text-primary flex items-center gap-1.5"><Bot size={14} className="text-secondary" />AI Account</span>
                </label>
                {isAI && (
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">AI Avatar *</label>
                        <select value={avatarId} onChange={(e) => setAvatarId(e.target.value as Id<"ai_avatars"> | "")} className={inputClass} disabled={saving}>
                            <option value="">Avatar auswählen…</option>
                            {avatars?.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                        </select>
                    </div>
                )}
                <button type="submit" disabled={saving || !username.trim()} className="w-full py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {saving ? <><Loader2 size={15} className="animate-spin" /> Speichern…</> : "Speichern"}
                </button>
            </form>
        </ModalShell>
    );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteConfirmModal({ account, onClose, onConfirm }: { account: SocialAccount; onClose: () => void; onConfirm: () => Promise<void> }) {
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input !== account.username) return;
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalShell title="Account löschen" onClose={onClose}>
            <form onSubmit={handleConfirm} className="p-5 space-y-4">
                <p className="text-sm text-secondary">
                    Diese Aktion kann nicht rückgängig gemacht werden. Gib <span className="font-semibold text-primary">{account.username}</span> ein, um zu bestätigen.
                </p>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={account.username}
                    autoFocus
                    className={inputClass}
                    disabled={loading}
                />
                <button
                    type="submit"
                    disabled={input !== account.username || loading}
                    className="w-full py-2.5 bg-red-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                    {loading ? <><Loader2 size={15} className="animate-spin" /> Löschen…</> : "Account löschen"}
                </button>
            </form>
        </ModalShell>
    );
}

// ── Helper for Stat Formatting ────────────────────────────────────────────────
const formatStat = (num?: number) => {
    if (num === undefined || num === null) return "—";
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return num.toLocaleString("de-DE");
};

// ── Account Card ───────────────────────────────────────────────────────────────

function AccountCard({ account, creatorEmail, onEdit, onDelete }: { account: SocialAccount; creatorEmail?: string; onEdit: () => void; onDelete: () => void }) {
    const isInstagram = account.platform === "instagram";
    const isTikTok = account.platform === "tiktok";

    // Platform-specific gradient styles for the avatar border
    const borderGradientClass = isInstagram
        ? "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]"
        : isTikTok
        ? "bg-gradient-to-tr from-[#00f2fe] via-[#fe2c55] to-[#f63a79]"
        : "bg-gradient-to-tr from-accent-blue to-accent";

    const platformBadgeClass = isInstagram
        ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
        : "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20";

    return (
        <div className="group relative overflow-hidden bg-surface2/40 hover:bg-surface2/70 border border-border hover:border-accent/30 rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-accent/5 flex flex-col justify-between h-full min-h-[260px]">
            {/* Hover aura light effect */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-accent/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        {/* Profile Image with platform gradient ring */}
                        <div className={`p-[2px] rounded-full ${borderGradientClass} transition-transform duration-300 group-hover:scale-105 shrink-0 shadow-lg`}>
                            {account.profileImageUrl ? (
                                <img 
                                    src={account.profileImageUrl} 
                                    alt={account.username} 
                                    className="w-11 h-11 rounded-full object-cover border-2 border-[#0B1220] shrink-0" 
                                />
                            ) : (
                                <div className="w-11 h-11 rounded-full bg-[#0B1220] flex items-center justify-center shrink-0 border-2 border-transparent">
                                    <Users size={18} className="text-secondary" />
                                </div>
                            )}
                        </div>

                        {/* Title & Platform badges */}
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm sm:text-base text-primary tracking-tight group-hover:text-accent transition-colors duration-200 truncate" title={`@${account.username}`}>
                                @{account.username}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {/* Platform Badge */}
                                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${platformBadgeClass}`}>
                                    {isInstagram && <Instagram size={10} />}
                                    {isTikTok && (
                                        <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.74-3.94-1.78-.22-.22-.41-.47-.58-.73v7.02c0 3.76-2.13 7.07-5.69 8.28-3.93 1.34-8.4-.73-9.74-4.66-1.34-3.93.73-8.4 4.66-9.74 1.45-.49 3.02-.45 4.45.1v4.28c-1.28-.6-2.86-.4-3.94.52-.97.82-1.36 2.19-.97 3.39.39 1.2 1.62 1.95 2.87 1.8 1.42-.17 2.45-1.47 2.37-2.9v-11.75c-.01-1.32.02-2.64-.02-3.96z" />
                                        </svg>
                                    )}
                                    {account.platform}
                                </span>

                                {/* AI Badge */}
                                {account.isAI && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 shadow-[0_0_8px_rgba(168,85,247,0.15)]">
                                        <Bot size={10} className="text-purple-400" /> AI
                                    </span>
                                )}

                                {/* Automation status */}
                                {account.postizId ? (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        Auto
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1" title="Dieser Account muss manuell bespielt werden.">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                        Manual
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-0.5 bg-[#0B1220]/50 border border-border/40 rounded-xl p-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={onEdit} 
                            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-[#0B1220]/80 border border-transparent hover:border-border transition-all duration-200"
                            title="Account bearbeiten"
                        >
                            <Pencil size={13} />
                        </button>
                        <button 
                            onClick={onDelete} 
                            className="p-2 rounded-lg text-secondary hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200"
                            title="Account löschen"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Bio text */}
                {account.bio && (
                    <p className="text-xs text-secondary/80 leading-relaxed font-light line-clamp-2 px-3 border-l-2 border-border/80 pl-3 italic">
                        "{account.bio}"
                    </p>
                )}

                {/* Details Section (Creator and Times) */}
                <div className="space-y-2 pt-1">
                    {/* Creator Assignment */}
                    {creatorEmail && (
                        <div className="flex items-center justify-between text-xs py-2 px-3 bg-[#0B1220]/30 border border-border/40 rounded-xl hover:bg-[#0B1220]/50 transition-colors">
                            <span className="text-secondary flex items-center gap-1.5 shrink-0">
                                <Users size={12} className="text-accent/80" /> Assigned
                            </span>
                            <span className="font-medium text-primary max-w-[160px] truncate" title={creatorEmail}>
                                {creatorEmail}
                            </span>
                        </div>
                    )}

                    {/* Schedule / Timezone & Times */}
                    {(account.timezone || (account.postingTimes && account.postingTimes.length > 0)) && (
                        <div className="py-2.5 px-3 bg-[#0B1220]/30 border border-border/40 rounded-xl hover:bg-[#0B1220]/50 transition-colors space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-secondary flex items-center gap-1.5">
                                    <Clock size={12} className="text-accent/80" /> Schedule
                                </span>
                                {account.timezone && (
                                    <span className="text-muted flex items-center gap-1 font-mono text-[9px] uppercase tracking-tight" title={`Zeitzone: ${account.timezone}`}>
                                        <Globe size={10} className="inline opacity-80" /> {account.timezone.split("/")[1]?.replace("_", " ") || account.timezone}
                                    </span>
                                )}
                            </div>
                            
                            {account.postingTimes && account.postingTimes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {account.postingTimes.sort().map((time, idx) => (
                                        <span key={idx} className="text-[10px] font-bold text-accent bg-accent/5 border border-accent/15 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                            {time}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[11px] text-muted block italic">Keine Posting-Zeiten</span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Section */}
            {account.followers !== undefined && (
                <div className="grid grid-cols-3 gap-1 bg-[#0B1220]/40 border border-border/40 rounded-xl p-2.5 text-center mt-4 group-hover:bg-[#0B1220]/60 transition-colors">
                    {[
                        { label: "Followers", value: account.followers },
                        { label: "Following", value: account.following },
                        { label: "Likes", value: account.likes },
                    ].map(({ label, value }) => (
                        <div key={label} className="min-w-0" title={value?.toLocaleString("de-DE") ?? "—"}>
                            <p className="text-xs font-bold text-primary truncate">
                                {formatStat(value)}
                            </p>
                            <p className="text-[9px] uppercase font-bold tracking-wider text-muted mt-0.5">
                                {label}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SocialAccountsPage() {
    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.type === "admin";

    const accounts = useQuery(api.social_accounts.queries.getAll);
    const allUsers = useQuery(api.users.queries.getAllUsers, isAdmin ? {} : "skip");
    const removeAccount = useMutation(api.social_accounts.mutations.remove);

    const [showAdd, setShowAdd] = useState(false);
    const [editTarget, setEditTarget] = useState<SocialAccount | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        await removeAccount({ id: deleteTarget._id });
        toast.success("Account entfernt.");
        setDeleteTarget(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-1">Social Accounts</h1>
                    <p className="text-secondary">Social-Media-Accounts verwalten und Creatorn zuweisen.</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all">
                    <Plus size={16} />
                    Account hinzufügen
                </button>
            </div>

            {accounts === undefined ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-36 rounded-2xl bg-surface2 animate-pulse" />
                    ))}
                </div>
            ) : accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <p className="text-secondary text-lg mb-1">Noch keine Accounts.</p>
                    <p className="text-secondary/60 text-sm">Füge deinen ersten Social-Media-Account hinzu.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {(accounts as SocialAccount[]).map((account) => (
                        <AccountCard
                            key={account._id}
                            account={account}
                            creatorEmail={allUsers?.find((u) => u._id === account.assignedTo)?.email}
                            onEdit={() => setEditTarget(account)}
                            onDelete={() => setDeleteTarget(account)}
                        />
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
                {editTarget && <EditModal account={editTarget} onClose={() => setEditTarget(null)} />}
                {deleteTarget && (
                    <DeleteConfirmModal
                        account={deleteTarget}
                        onClose={() => setDeleteTarget(null)}
                        onConfirm={handleDelete}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
