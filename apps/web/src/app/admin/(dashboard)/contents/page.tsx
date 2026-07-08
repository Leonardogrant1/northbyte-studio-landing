"use client";

import { RecentContents } from "@/components/admin/RecentContents";

export default function ContentsPage() {
    return (
        <div className="flex-1 overflow-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Contents</h1>
                <p className="text-secondary">Zuletzt erstellte Inhalte & Status</p>
            </div>
            <RecentContents showAll />
        </div>
    );
}
