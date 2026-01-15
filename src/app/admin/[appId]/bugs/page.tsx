import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BugKanbanBoard } from "@/components/admin/BugKanbanBoard";
import { Id } from "@/../convex/_generated/dataModel";

interface PageProps {
    params: Promise<{
        appId: string;
    }>;
}

export default async function BugsPage({ params }: PageProps) {
    const adminStatus = await isAdmin();

    if (!adminStatus) {
        redirect("/admin/login");
    }

    const { appId } = await params;

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto">
                <AdminHeader />

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Bug Reports</h1>
                    <p className="text-secondary">
                        Manage and edit bug reports for this app
                    </p>
                </div>

                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8">
                    <BugKanbanBoard appId={appId as Id<"apps">} />
                </div>
            </div>
        </div>
    );
}
