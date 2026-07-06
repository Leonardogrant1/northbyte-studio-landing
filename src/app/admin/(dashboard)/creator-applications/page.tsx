"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/../convex/_generated/api";
import { Id } from "@/../convex/_generated/dataModel";
import { CreatorApplicationBoard } from "@/components/admin/CreatorApplicationBoard";

function CreatorApplicationsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app") as Id<"apps"> | null;

    const apps = useQuery(api.apps.queries.getAll);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Creator Applications</h1>
                <p className="text-secondary">Manage and review incoming creator applications</p>
            </div>

            {apps && apps.length > 0 && (
                <div className="flex gap-2 mb-8 flex-wrap">
                    <button
                        onClick={() => router.push("/admin/creator-applications")}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                            selectedAppId === null
                                ? "bg-accent/10 border-accent text-accent"
                                : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                        }`}
                    >
                        Alle
                    </button>
                    {apps.map((app) => (
                        <button
                            key={app._id}
                            onClick={() => router.push(`/admin/creator-applications?app=${app._id}`)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                selectedAppId === app._id
                                    ? "bg-accent/10 border-accent text-accent"
                                    : "border-border text-secondary hover:border-accent/50 hover:text-primary"
                            }`}
                        >
                            {app.name}
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8">
                <CreatorApplicationBoard appId={selectedAppId} />
            </div>
        </div>
    );
}

export default function CreatorApplicationsPage() {
    return (
        <Suspense fallback={<div className="text-secondary">Loading...</div>}>
            <CreatorApplicationsContent />
        </Suspense>
    );
}
