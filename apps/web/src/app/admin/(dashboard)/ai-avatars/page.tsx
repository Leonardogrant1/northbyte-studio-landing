"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { Plus, X, Loader2, Trash2, Upload, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

async function uploadImageToR2(file: File): Promise<string> {
    const res = await fetch("/api/upload-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to get upload URL");

    const uploadRes = await fetch(data.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload image");

    return data.fileUrl;
}

const ACCEPTED_IMAGE = "image/jpeg,image/png,image/webp";

const inputClass =
    "w-full bg-background border border-border rounded-xl px-4 py-2.5 text-primary text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all disabled:opacity-50";

type CountryCode = "de" | "br" | "us";
type Ethnicity = "white" | "black" | "light-skin" | "asian" | "indian" | "brown";

const COUNTRY_LABELS: Record<CountryCode, string> = { de: "Deutschland", br: "Brasilien", us: "USA" };
const ETHNICITY_LABELS: Record<Ethnicity, string> = {
    white: "White",
    black: "Black",
    "light-skin": "Light-Skin",
    asian: "Asian",
    indian: "Indian",
    brown: "Brown",
};

interface FormState {
    name: string;
    description: string;
    gender: "" | "male" | "female" | "diverse";
    ethnicity: "" | Ethnicity;
    country: "" | CountryCode;
    language: string;
}

const EMPTY_FORM: FormState = {
    name: "",
    description: "",
    gender: "",
    ethnicity: "",
    country: "",
    language: "",
};

function CreateModal({ onClose }: { onClose: () => void }) {
    const createAvatar = useMutation(api.ai_avatars.mutations.create);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleImage = (file: File) => {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!imageFile) { toast.error("Select an image."); return; }
        if (!form.ethnicity) { toast.error("Select an ethnicity."); return; }
        if (!form.country) { toast.error("Select a country."); return; }
        if (!form.language) { toast.error("Select a language."); return; }
        if (!form.gender) { toast.error("Select a gender."); return; }

        setLoading(true);
        try {
            const imageUrl = await uploadImageToR2(imageFile);
            await createAvatar({
                name: form.name.trim(),
                imageUrl,
                description: form.description.trim(),
                gender: form.gender,
                ethnicity: form.ethnicity,
                country: form.country,
                language: form.language,
            });
            toast.success("Avatar erstellt.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Erstellen.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-surface2/95 border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h2 className="text-lg font-semibold">Neuer AI Avatar</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Image upload */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Bild *</label>
                        <div
                            className="relative w-24 h-24 rounded-2xl overflow-hidden bg-background border border-border cursor-pointer hover:border-accent/50 transition-colors flex items-center justify-center"
                            onClick={() => inputRef.current?.click()}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={20} className="text-secondary" />
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPTED_IMAGE}
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Name *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={set("name")}
                            required
                            placeholder="z.B. Sophia"
                            className={inputClass}
                            disabled={loading}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Beschreibung *</label>
                        <textarea
                            value={form.description}
                            onChange={set("description")}
                            required
                            rows={3}
                            placeholder="Kurze Beschreibung des Avatars…"
                            className={inputClass + " resize-none"}
                            disabled={loading}
                        />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Geschlecht</label>
                        <select
                            value={form.gender}
                            onChange={set("gender")}
                            className={inputClass}
                            disabled={loading}
                        >
                            <option value="">Keine Angabe</option>
                            <option value="male">Männlich</option>
                            <option value="female">Weiblich</option>
                            <option value="diverse">Divers</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Ethnicity */}
                        <div>
                            <label className="text-xs font-medium text-secondary block mb-1">Ethnizität</label>
                            <select value={form.ethnicity} onChange={set("ethnicity")} className={inputClass} disabled={loading}>
                                <option value="">Keine Angabe</option>
                                <option value="white">White</option>
                                <option value="black">Black</option>
                                <option value="light-skin">Light-Skin</option>
                                <option value="asian">Asian</option>
                                <option value="indian">Indian</option>
                                <option value="brown">Brown</option>
                            </select>
                        </div>

                        {/* Country */}
                        <div>
                            <label className="text-xs font-medium text-secondary block mb-1">Land</label>
                            <select value={form.country} onChange={set("country")} className={inputClass} disabled={loading}>
                                <option value="">Keine Angabe</option>
                                <option value="de">Deutschland</option>
                                <option value="br">Brasilien</option>
                                <option value="us">USA</option>
                            </select>
                        </div>
                    </div>

                    {/* Language */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Sprache</label>
                        <select
                            value={form.language}
                            onChange={set("language")}
                            className={inputClass}
                            disabled={loading}
                        >
                            <option value="">Keine Angabe</option>
                            <option value="de">Deutsch</option>
                            <option value="en">Englisch</option>
                            <option value="es">Spanisch</option>
                            <option value="pt">Portugiesisch</option>
                            <option value="fr">Französisch</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !form.name.trim() || !form.description.trim() || !imageFile}
                        className="w-full py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Wird erstellt…</>
                        ) : "Avatar erstellen"}
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
}

type AvatarDoc = {
    _id: Id<"ai_avatars">;
    name: string;
    imageUrl: string;
    description: string;
    gender?: "male" | "female" | "diverse";
    ethnicity?: Ethnicity;
    country?: CountryCode;
    language?: string;
};

function EditModal({ avatar, onClose }: { avatar: AvatarDoc; onClose: () => void }) {
    const updateAvatar = useMutation(api.ai_avatars.mutations.update);

    const [form, setForm] = useState<FormState>({
        name: avatar.name,
        description: avatar.description,
        gender: avatar.gender ?? "",
        ethnicity: avatar.ethnicity ?? "",
        country: avatar.country ?? "",
        language: avatar.language ?? "",
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(avatar.imageUrl);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleImage = (file: File) => {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const imageUrl = imageFile ? await uploadImageToR2(imageFile) : avatar.imageUrl;
            await updateAvatar({
                id: avatar._id,
                name: form.name.trim(),
                imageUrl,
                description: form.description.trim(),
                gender: form.gender || undefined,
                ethnicity: (form.ethnicity as Ethnicity) || undefined,
                country: (form.country as CountryCode) || undefined,
                language: form.language || undefined,
            });
            toast.success("Avatar aktualisiert.");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Fehler beim Speichern.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="bg-surface2/95 border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <h2 className="text-lg font-semibold">Avatar bearbeiten</h2>
                    <button onClick={onClose} className="text-secondary hover:text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Image upload */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Bild</label>
                        <div
                            className="relative w-24 h-24 rounded-2xl overflow-hidden bg-background border border-border cursor-pointer hover:border-accent/50 transition-colors flex items-center justify-center"
                            onClick={() => inputRef.current?.click()}
                        >
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload size={20} className="text-secondary" />
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept={ACCEPTED_IMAGE}
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Name *</label>
                        <input type="text" value={form.name} onChange={set("name")} required placeholder="z.B. Sophia" className={inputClass} disabled={loading} />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Beschreibung *</label>
                        <textarea value={form.description} onChange={set("description")} required rows={3} placeholder="Kurze Beschreibung…" className={inputClass + " resize-none"} disabled={loading} />
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Geschlecht</label>
                        <select value={form.gender} onChange={set("gender")} className={inputClass} disabled={loading}>
                            <option value="">Keine Angabe</option>
                            <option value="male">Männlich</option>
                            <option value="female">Weiblich</option>
                            <option value="diverse">Divers</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-secondary block mb-1">Ethnizität</label>
                            <select value={form.ethnicity} onChange={set("ethnicity")} className={inputClass} disabled={loading}>
                                <option value="">Keine Angabe</option>
                                <option value="white">White</option>
                                <option value="black">Black</option>
                                <option value="light-skin">Light-Skin</option>
                                <option value="asian">Asian</option>
                                <option value="indian">Indian</option>
                                <option value="brown">Brown</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-secondary block mb-1">Land</label>
                            <select value={form.country} onChange={set("country")} className={inputClass} disabled={loading}>
                                <option value="">Keine Angabe</option>
                                <option value="de">Deutschland</option>
                                <option value="br">Brasilien</option>
                                <option value="us">USA</option>
                            </select>
                        </div>
                    </div>

                    {/* Language */}
                    <div>
                        <label className="text-xs font-medium text-secondary block mb-1">Sprache</label>
                        <select value={form.language} onChange={set("language")} className={inputClass} disabled={loading}>
                            <option value="">Keine Angabe</option>
                            <option value="de">Deutsch</option>
                            <option value="en">Englisch</option>
                            <option value="es">Spanisch</option>
                            <option value="pt">Portugiesisch</option>
                            <option value="fr">Französisch</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !form.name.trim() || !form.description.trim()}
                        className="w-full py-3 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Wird gespeichert…</>
                        ) : "Speichern"}
                    </button>
                </form>
            </motion.div>
        </motion.div>
    );
}

function AvatarCard({ avatar, onDelete, onEdit }: { avatar: AvatarDoc; onDelete: () => void; onEdit: () => void }) {
    const LANG_LABELS: Record<string, string> = { de: "DE", en: "EN", es: "ES", pt: "PT", fr: "FR" };
    const GENDER_LABELS: Record<string, string> = { male: "Männlich", female: "Weiblich", diverse: "Divers" };

    return (
        <div className="bg-surface2 border border-border rounded-2xl overflow-hidden group">
            <div className="aspect-square overflow-hidden bg-background">
                <img src={avatar.imageUrl} alt={avatar.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-primary truncate">{avatar.name}</h3>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onEdit} className="shrink-0 text-secondary hover:text-accent transition-colors">
                            <Pencil size={14} />
                        </button>
                        <button onClick={onDelete} className="shrink-0 text-secondary hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
                <p className="text-xs text-secondary line-clamp-2">{avatar.description}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {avatar.gender && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-secondary">{GENDER_LABELS[avatar.gender]}</span>
                    )}
                    {avatar.ethnicity && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-secondary">{ETHNICITY_LABELS[avatar.ethnicity]}</span>
                    )}
                    {avatar.country && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-secondary">{COUNTRY_LABELS[avatar.country]}</span>
                    )}
                    {avatar.language && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">{LANG_LABELS[avatar.language] ?? avatar.language}</span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AIAvatarsPage() {
    const avatars = useQuery(api.ai_avatars.queries.getAll);
    const removeAvatar = useMutation(api.ai_avatars.mutations.remove);
    const [showCreate, setShowCreate] = useState(false);
    const [editAvatar, setEditAvatar] = useState<AvatarDoc | null>(null);

    const handleDelete = async (id: Id<"ai_avatars">, name: string) => {
        if (!confirm(`„${name}" wirklich löschen?`)) return;
        try {
            await removeAvatar({ id });
            toast.success("Avatar gelöscht.");
        } catch {
            toast.error("Fehler beim Löschen.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-1">AI Avatars</h1>
                    <p className="text-secondary">KI-Avatare erstellen und verwalten.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-accent text-background font-semibold rounded-xl hover:opacity-90 transition-all text-sm"
                >
                    <Plus size={16} />
                    Neu erstellen
                </button>
            </div>

            {avatars === undefined ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-2xl bg-surface2 animate-pulse aspect-square" />
                    ))}
                </div>
            ) : avatars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <p className="text-secondary text-lg mb-2">Noch keine Avatare.</p>
                    <p className="text-secondary/60 text-sm">Erstelle deinen ersten AI Avatar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {avatars.map((avatar) => (
                        <AvatarCard
                            key={avatar._id}
                            avatar={avatar}
                            onDelete={() => handleDelete(avatar._id, avatar.name)}
                            onEdit={() => setEditAvatar(avatar)}
                        />
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
                {editAvatar && <EditModal avatar={editAvatar} onClose={() => setEditAvatar(null)} />}
            </AnimatePresence>
        </div>
    );
}
