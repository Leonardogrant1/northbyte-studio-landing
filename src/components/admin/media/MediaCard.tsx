"use client";

import { useState } from "react";
import { Expand, Video } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

export interface MediaItem {
    _id: Id<"media">;
    title: string;
    type: "video" | "image";
    fileUrl: string;
    thumbnailUrl: string;
    appId?: Id<"apps">;
    avatarId?: Id<"ai_avatars">;
    contentType?: "creator" | "demo";
    gender?: "male" | "female" | "diverse";
    skinTone?: "white" | "black" | "light-skin" | "asian" | "indian" | "brown";
    language?: string;
    uploadedBy: Id<"users">;
    createdAt: number;
}

interface MediaCardProps {
    item: MediaItem;
    onClick: () => void;
}

export function MediaCard({ item, onClick }: MediaCardProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className="relative rounded-xl overflow-hidden cursor-pointer bg-surface2 group"
            style={{ aspectRatio: "9/16" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={onClick}
        >
            <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                loading="lazy"
            />

            {item.type === "video" && (
                <div className="absolute top-2 left-2">
                    <div className="bg-black/60 backdrop-blur-sm rounded-md p-1">
                        <Video size={12} className="text-white" />
                    </div>
                </div>
            )}

            {hovered && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-all">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                        <Expand size={22} className="text-white" />
                    </div>
                </div>
            )}

            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-medium truncate">{item.title}</p>
            </div>
        </div>
    );
}
