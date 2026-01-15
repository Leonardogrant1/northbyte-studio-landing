"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface App {
    _id: Id<"apps">;
    name: string;
    tagline: string;
    description: string;
    status: string;
}

export function useSelectedApp() {
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const apps = useQuery(api.apps.queries.getAll);

    // Load selected app ID from localStorage on mount
    useEffect(() => {
        const savedAppId = localStorage.getItem("selectedAppId");
        if (savedAppId) {
            setSelectedAppId(savedAppId);
        } else if (apps && apps.length > 0) {
            setSelectedAppId(apps[0]._id);
        }
    }, [apps]);

    // Find the selected app from the apps list
    const selectedApp = apps?.find((app) => app._id === selectedAppId) || null;

    return {
        selectedApp,
        selectedAppId,
        apps,
    };
}
