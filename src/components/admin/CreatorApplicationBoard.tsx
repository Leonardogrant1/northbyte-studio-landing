"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { GenericKanbanBoard, KanbanItem } from "./GenericKanbanBoard";
import { CREATOR_APPLICATION_COLUMNS } from "@/lib/kanban-config";
import { Trash2, ExternalLink, Phone, Mail, Globe } from "lucide-react";
import { useState } from "react";

interface CreatorApplication {
    _id: Id<"creator_application">;
    _creationTime: number;
    name: string;
    email: string;
    phone: string;
    social_accounts?: string[];
    app_id: Id<"apps">;
    video_link?: string;
    description?: string;
    country: string;
    status: string;
}

type CreatorApplicationKanbanItem = CreatorApplication & KanbanItem;

interface CreatorApplicationBoardProps {
    appId: Id<"apps"> | null;
}

function ApplicationCard({ item }: { item: CreatorApplicationKanbanItem }) {
    return (
        <>
            <h3 className="font-semibold text-primary mb-1">{item.name}</h3>
            <div className="flex flex-col gap-1 mb-3">
                <span className="flex items-center gap-1.5 text-xs text-secondary">
                    <Mail size={11} />
                    {item.email}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-secondary">
                    <Phone size={11} />
                    {item.phone}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-secondary">
                    <Globe size={11} />
                    {item.country}
                </span>
            </div>
            {item.social_accounts && item.social_accounts.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {item.social_accounts.map((account, i) => (
                        <span
                            key={i}
                            className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full"
                        >
                            {account}
                        </span>
                    ))}
                </div>
            )}
            {item.description && (
                <p className="text-xs text-secondary line-clamp-2 mb-3">{item.description}</p>
            )}
            {item.video_link && (
                <a
                    href={item.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                    <ExternalLink size={11} />
                    Video ansehen
                </a>
            )}
        </>
    );
}

export function CreatorApplicationBoard({ appId }: CreatorApplicationBoardProps) {
    const [clearing, setClearing] = useState(false);

    const allApplications = useQuery(api.generic.queries.getAll, { table: "creator_application" });
    const updateApplication = useMutation(api.generic.mutations.updateById);
    const deleteRejected = useMutation(api.creator_application.mutations.deleteRejected);

    const applications: CreatorApplicationKanbanItem[] = (
        (allApplications ?? []) as CreatorApplication[]
    )
        .filter((a) => appId === null || a.app_id === appId)
        .map((a) => ({
            ...a,
            title: a.name,
            description: a.description ?? "",
            upvotes: 0,
        }));

    const rejectedCount = applications.filter((a) => a.status === "rejected").length;

    const handleStatusChange = (id: string, newStatus: string) => {
        updateApplication({ id, patch: { status: newStatus } });
    };

    const handleClearRejected = async () => {
        if (!appId || rejectedCount === 0) return;
        setClearing(true);
        try {
            await deleteRejected({ appId });
        } finally {
            setClearing(false);
        }
    };

    return (
        <div>
            {appId !== null && rejectedCount > 0 && (
                <div className="flex justify-end mb-6">
                    <button
                        onClick={handleClearRejected}
                        disabled={clearing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                        <Trash2 size={14} />
                        {clearing ? "Löschen..." : `Clear Rejected (${rejectedCount})`}
                    </button>
                </div>
            )}
            <GenericKanbanBoard<CreatorApplicationKanbanItem>
                items={applications}
                columns={CREATOR_APPLICATION_COLUMNS}
                onStatusChange={handleStatusChange}
                renderCardContent={(item) => <ApplicationCard item={item} />}
            />
        </div>
    );
}
