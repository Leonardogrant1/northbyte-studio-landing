import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminLoginRoute = createRouteMatcher(["/admin/login"]);
const isAdminSignupRoute = createRouteMatcher(["/admin/signup"]);

export default clerkMiddleware(async (auth, req) => {
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
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
