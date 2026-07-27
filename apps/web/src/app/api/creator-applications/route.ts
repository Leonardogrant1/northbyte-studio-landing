import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@repo/backend/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            app_slug,
            name,
            email,
            phone,
            country,
            social_accounts,
            video_link,
            description,
        } = body as {
            app_slug: string;
            name: string;
            email: string;
            phone: string;
            country: string;
            social_accounts?: string[];
            video_link?: string;
            description?: string;
        };

        if (!app_slug || !name || !email || !phone || !country) {
            return NextResponse.json(
                { error: "Missing required fields: app_slug, name, email, phone, country" },
                { status: 400 },
            );
        }

        const app = await convex.query(api.apps.queries.getBySlug, { slug: app_slug });
        if (!app) {
            return NextResponse.json({ error: `App not found: ${app_slug}` }, { status: 404 });
        }

        const existingApplication = await convex.query(
            api.creator_application.queries.getByEmailAndApp,
            { email, app_id: app._id },
        );
        if (existingApplication) {
            return NextResponse.json(
                { error: "An application with this email address already exists for this app." },
                { status: 409 },
            );
        }

        const id = await convex.mutation(api.creator_application.mutations.create, {
            app_id: app._id,
            name,
            email,
            phone,
            country,
            social_accounts: social_accounts ?? undefined,
            video_link: video_link ?? undefined,
            description: description ?? undefined,
        });

        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error) {
        console.error("Error creating creator application:", error);
        return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
    }
}
