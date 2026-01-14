import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface PageProps {
    params: Promise<{
        appId: string;
    }>;
}

export default async function SettingsPage({ params }: PageProps) {
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
                    <h1 className="text-3xl font-bold mb-2">App Settings</h1>
                    <p className="text-secondary">
                        Verwalte die Einstellungen für diese App
                    </p>
                </div>

                {/* Settings form will be implemented here */}
                <div className="bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl p-8">
                    <p className="text-secondary text-center">
                        App-Einstellungen werden hier implementiert...
                    </p>
                </div>
            </div>
        </div>
    );
}
