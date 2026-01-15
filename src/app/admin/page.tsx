import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function AdminPage() {
    const adminStatus = await isAdmin();

    if (!adminStatus) {
        redirect("/admin/login");
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                <AdminHeader />

                <div className="mt-8">
                    <h2 className="text-2xl font-bold mb-6">Select an App</h2>
                    <p className="text-secondary mb-8">
                        Wähle eine App aus, um das Dashboard zu öffnen, oder erstelle eine neue App.
                    </p>

                    {/* App selection will be handled by AppSelector component */}
                    <div className="text-center py-12">
                        <p className="text-muted mb-4">Use the app selector above to choose an app</p>
                        <Link
                            href="/admin/create-app"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-background rounded-xl font-medium hover:bg-accent/90 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create New App
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
