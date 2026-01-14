import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface PageProps {
    params: Promise<{
        appId: string;
    }>;
}

export default async function FeaturesPage({ params }: PageProps) {
    const adminStatus = await isAdmin();

    if (!adminStatus) {
        redirect("/admin/login");
    }

    const { appId } = await params;

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                <AdminHeader />

                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Feature Requests</h1>
                    <p className="text-secondary">
                        Verwalte Feature-Requests für diese App
                    </p>
                </div>

                {/* Feature list will be implemented here */}
                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8">
                    <p className="text-secondary text-center">
                        Feature-Verwaltung wird hier implementiert...
                    </p>
                </div>
            </div>
        </div>
    );
}
