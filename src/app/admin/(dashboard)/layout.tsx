import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const adminStatus = await isAdmin();

    if (!adminStatus) {
        redirect("/admin/login");
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="px-8 pt-6 pb-4 border-b border-border">
                <AdminHeader />
            </div>
            <div className="flex flex-1">
                <AdminSidebar />
                <main className="flex-1 p-8 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
