"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

import { MediaGrid } from "@/components/admin/media/MediaGrid";
import { MediaModal } from "@/components/admin/media/MediaModal";
import { UploadModal } from "@/components/admin/media/UploadModal";
import { MediaItem } from "@/components/admin/media/MediaCard";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { api } from "@repo/backend/convex/_generated/api";

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

const DEFAULT_FILTERS: Filters = {
    appId: "",
    uploadedBy: "",
    avatarId: "",
    type: "",
    contentType: "",
    gender: "",
    skinTone: "",
    language: "",
};

export default function MediaPage() {
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
    const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
    const [showUpload, setShowUpload] = useState(false);

    const currentUser = useCurrentUser();
    const isAdmin = currentUser?.type === "admin";

    const apps = useQuery(api.apps.queries.getAccessibleApps);
    const users = useQuery(api.users.queries.getAllUsers, isAdmin ? {} : "skip");
    const avatars = useQuery(api.ai_avatars.queries.getAll);

    const items = useQuery(api.media.queries.getAll, {
        appId: filters.appId || undefined,
        uploadedBy: filters.uploadedBy || undefined,
        avatarId: filters.avatarId || undefined,
        type: filters.type || undefined,
        contentType: filters.contentType || undefined,
        gender: filters.gender || undefined,
        skinTone: filters.skinTone || undefined,
        language: filters.language || undefined,
    });

    const handleFilterChange = useCallback((partial: Partial<Filters>) => {
        setFilters((prev) => ({ ...prev, ...partial }));
    }, []);

    const appName = apps?.find((a) => a._id === selectedItem?.appId)?.name;
    const avatarName = avatars?.find((a) => a._id === selectedItem?.avatarId)?.name;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-1">Media</h1>
                <p className="text-secondary">Wiederverwendbare Medien für Creator.</p>
            </div>

            <MediaGrid
                items={items as MediaItem[] | undefined}
                apps={apps}
                users={users}
                avatars={avatars}
                filters={filters}
                onFilterChange={handleFilterChange}
                onCardClick={setSelectedItem}
                onUploadClick={() => setShowUpload(true)}
            />

            <MediaModal
                item={selectedItem}
                appName={appName}
                avatarName={avatarName}
                onClose={() => setSelectedItem(null)}
                onDeleted={() => setSelectedItem(null)}
            />

            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUploaded={() => setShowUpload(false)}
                />
            )}
        </div>
    );
}
