import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface PageProps {
    params: Promise<{
        appId: string;
    }>;
}

export default async function AppDashboardPage({ params }: PageProps) {
    const adminStatus = await isAdmin();

    if (!adminStatus) {
        redirect("/admin/login");
    }

    const { appId } = await params;

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-6xl mx-auto">
                <AdminHeader />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Link
                        href={`/admin/${appId}/bugs`}
                        className="p-8 bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl hover:border-accent transition-all group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold group-hover:text-accent transition-colors">
                                Bugs
                            </h2>
                        </div>
                        <p className="text-secondary">
                            Bug-Reports verwalten und bearbeiten
                        </p>
                    </Link>

                    <Link
                        href={`/admin/${appId}/features`}
                        className="p-8 bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl hover:border-accent transition-all group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-accent/10 rounded-xl">
                                <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold group-hover:text-accent transition-colors">
                                Features
                            </h2>
                        </div>
                        <p className="text-secondary">
                            Feature-Requests verwalten und priorisieren
                        </p>
                    </Link>

                    <Link
                        href={`/admin/${appId}/settings`}
                        className="p-8 bg-surface2/50 backdrop-blur-xl border border-border rounded-3xl hover:border-accent transition-all group"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold group-hover:text-accent transition-colors">
                                Settings
                            </h2>
                        </div>
                        <p className="text-secondary">
                            App-Einstellungen anpassen
                        </p>
                    </Link>
                </div>
            </div>
        </div>
    );
}
