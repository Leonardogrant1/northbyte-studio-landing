import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";
import AdminAnalyticsDashboard from "./_AdminAnalyticsDashboard";

export default async function AdminDashboardPage() {
    const { getToken } = await auth();

    let token: string | null = null;
    try {
        token = await getToken({ template: "convex" });
    } catch {
        // getToken failed — fall through to client-side RoleGuard
    }

    if (token) {
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
        convex.setAuth(token);
        const user = await convex.query(api.users.queries.getCurrentUser, {});
        if (user?.type === "affiliate") {
            redirect("/admin/affiliate");
        }
    }

    return <AdminAnalyticsDashboard />;
}
