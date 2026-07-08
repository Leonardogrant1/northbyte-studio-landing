"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@repo/backend/convex/_generated/api";
import { Id } from "@repo/backend/convex/_generated/dataModel";
import { FeatureKanbanBoard } from "@/components/admin/FeatureKanbanBoard";
import { Lightbulb } from "lucide-react";

function FeaturesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedAppId = searchParams.get("app") as Id<"apps"> | null;

    const apps = useQuery(api.apps.queries.getAll);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Feature Requests</h1>
                <p className="text-secondary">Manage and prioritize feature requests</p>
            </div>

            {apps && apps.length > 0 && (
                <div className="flex gap-2 mb-8 flex-wrap">
                    {apps.map((app) => (
                        <button
                            key={app._id}
                            onClick={() => router.push(`/admin/features?app=${app._id}`)}
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

            {selectedAppId ? (
                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8">
                    <FeatureKanbanBoard appId={selectedAppId} />
                </div>
            ) : (
                <div className="flex items-center justify-center py-24 bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl">
                    <div className="text-center">
                        <Lightbulb size={48} className="text-secondary mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">Select a Project</p>
                        <p className="text-secondary">Wähle ein Projekt aus, um die Feature Requests zu sehen.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function FeaturesPage() {
    return (
        <Suspense fallback={<div className="text-secondary">Loading...</div>}>
            <FeaturesContent />
        </Suspense>
    );
}
