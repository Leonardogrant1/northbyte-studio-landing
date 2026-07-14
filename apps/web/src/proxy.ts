import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin/login"]);
const isAdminSignupRoute = createRouteMatcher(["/admin/signup"]);
const isExpenseRoute = createRouteMatcher(["/api/expenses(.*)"]);
const isAffiliateWebhookRoute = createRouteMatcher(["/api/affiliate(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    // Let affiliate webhook routes pass through — they handle their own auth
    if (isAffiliateWebhookRoute(req)) {
        return NextResponse.next();
    }

    // Protect all admin routes
    if (isAdminRoute(req)) {
        const { userId } = await auth();

        // If not authenticated and not on login or signup page, redirect to login
        if (!userId && !isAdminLoginRoute(req) && !isAdminSignupRoute(req)) {
            const loginUrl = new URL("/admin/login", req.url);
            return NextResponse.redirect(loginUrl);
        }


        // If authenticated and on login or signup page, redirect to admin dashboard
        if (userId && (isAdminLoginRoute(req) || isAdminSignupRoute(req))) {
            const adminUrl = new URL("/admin", req.url);
            return NextResponse.redirect(adminUrl);
        }

    }

    // Protect Expense API Routes
    if (isExpenseRoute(req)) {
        // Require Pre-Shared Secret API Key from n8n
        const authHeader = req.headers.get("authorization");
        const isValidKey = authHeader === `Bearer ${process.env.N8N_API_KEY}`;

        if (!isValidKey) {
            return new NextResponse(
                JSON.stringify({ error: "Unauthorized access: Invalid API Key" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        return NextResponse.next();
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|api/affiliate|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes (except affiliate webhooks — they handle their own auth)
        "/(api(?!/affiliate)|trpc)(.*)",
        "/__clerk/(pr.*)",
    ],
};
