"use client";

import { Upload } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { MediaCard, MediaItem } from "./MediaCard";

interface App {
    _id: Id<"apps">;
    name: string;
}

interface User {
    _id: Id<"users">;
    email?: string;
}

interface Avatar {
    _id: Id<"ai_avatars">;
    name: string;
}

interface Filters {
    appId: Id<"apps"> | "";
    uploadedBy: Id<"users"> | "";
    avatarId: Id<"ai_avatars"> | "";
    type: "video" | "image" | "";
    contentType: "creator" | "demo" | "";
    gender: "male" | "female" | "diverse" | "";
    skinTone: "white" | "black" | "light-skin" | "asian" | "indian" | "brown" | "";
    language: string;
}

interface MediaGridProps {
    items: MediaItem[] | undefined;
    apps: App[] | undefined;
    users: User[] | undefined;
    avatars: Avatar[] | undefined;
    filters: Filters;
    onFilterChange: (filters: Partial<Filters>) => void;
    onCardClick: (item: MediaItem) => void;
    onUploadClick: () => void;
}

const pillBase = "px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer";
const pillActive = "bg-accent text-background";
const pillInactive = "bg-surface2 border border-border text-secondary hover:border-accent/50";

export function MediaGrid({ items, apps, users, avatars, filters, onFilterChange, onCardClick, onUploadClick }: MediaGridProps) {
    return (
        <div className="space-y-5">
            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* App filter */}
                <select
                    value={filters.appId}
                    onChange={(e) => onFilterChange({ appId: e.target.value as Id<"apps"> | "" })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Apps</option>
                    {apps?.map((app) => (
                        <option key={app._id} value={app._id}>{app.name}</option>
                    ))}
                </select>

                {/* Creator filter */}
                <select
                    value={filters.uploadedBy}
                    onChange={(e) => onFilterChange({ uploadedBy: e.target.value as Id<"users"> | "" })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Creator</option>
                    {users?.map((u) => (
                        <option key={u._id} value={u._id}>{u.email ?? u._id}</option>
                    ))}
                </select>

                {/* Avatar filter */}
                <select
                    value={filters.avatarId}
                    onChange={(e) => onFilterChange({ avatarId: e.target.value as Id<"ai_avatars"> | "" })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Avatare</option>
                    {avatars?.map((a) => (
                        <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                </select>

                {/* Content type */}
                <div className="flex gap-1">
                    {(["", "creator", "demo"] as const).map((ct) => (
                        <button
                            key={ct}
                            onClick={() => onFilterChange({ contentType: ct })}
                            className={`${pillBase} ${filters.contentType === ct ? pillActive : pillInactive}`}
                        >
                            {ct === "" ? "Alle" : ct === "creator" ? "Creator" : "Demo"}
                        </button>
                    ))}
                </div>

                {/* Type */}
                <div className="flex gap-1">
                    {(["", "video", "image"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => onFilterChange({ type: t })}
                            className={`${pillBase} ${filters.type === t ? pillActive : pillInactive}`}
                        >
                            {t === "" ? "Alle" : t === "video" ? "Video" : "Bild"}
                        </button>
                    ))}
                </div>

                {/* Gender */}
                <div className="flex gap-1">
                    {(["", "male", "female", "diverse"] as const).map((g) => (
                        <button
                            key={g}
                            onClick={() => onFilterChange({ gender: g })}
                            className={`${pillBase} ${filters.gender === g ? pillActive : pillInactive}`}
                        >
                            {g === "" ? "Alle" : g === "male" ? "Männlich" : g === "female" ? "Weiblich" : "Divers"}
                        </button>
                    ))}
                </div>

                {/* Skin tone */}
                <select
                    value={filters.skinTone}
                    onChange={(e) => onFilterChange({ skinTone: e.target.value as Filters["skinTone"] })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Hauttöne</option>
                    <option value="white">White</option>
                    <option value="black">Black</option>
                    <option value="light-skin">Light-Skin</option>
                    <option value="asian">Asian</option>
                    <option value="indian">Indian</option>
                    <option value="brown">Brown</option>
                </select>

                {/* Language */}
                <select
                    value={filters.language}
                    onChange={(e) => onFilterChange({ language: e.target.value })}
                    className="bg-surface2 border border-border rounded-xl px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent transition-all"
                >
                    <option value="">Alle Sprachen</option>
                    <option value="de">Deutsch</option>
                    <option value="en">Englisch</option>
                    <option value="es">Spanisch</option>
                    <option value="pt">Portugiesisch</option>
                    <option value="fr">Französisch</option>
                </select>

                {/* Upload button — pushed to right */}
                <button
                    onClick={onUploadClick}
                    className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-accent text-background text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
                >
                    <Upload size={15} />
                    Upload
                </button>
            </div>

            {/* Grid */}
            {items === undefined ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="rounded-xl bg-surface2 animate-pulse" style={{ aspectRatio: "9/16" }} />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-secondary text-lg mb-2">Keine Medien gefunden.</p>
                    <p className="text-secondary/60 text-sm">Passe die Filter an oder lade etwas hoch.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {items.map((item) => (
                        <MediaCard key={item._id} item={item} onClick={() => onCardClick(item)} />
                    ))}
                </div>
            )}
        </div>
    );
}
