import { NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../../convex/_generated/api";

// Hardcoded fallback content
import { keevioPrivacyPolicy } from "@/lib/privacy-policies/keevio";
import { memolibPrivacyPolicy } from "@/lib/privacy-policies/memolib";
import { generalPrivacyPolicy } from "@/lib/privacy-policies/general";
import { keevioTermsOfUse } from "@/lib/privacy-policies/keevio-terms";
import { memolibTermsOfUse } from "@/lib/privacy-policies/memolib-terms";
import { generalTermsOfUse } from "@/lib/privacy-policies/general-terms";

type LegalDocumentType = "privacy_policy" | "terms_of_use";

const VALID_TYPES: LegalDocumentType[] = ["privacy_policy", "terms_of_use"];

// Fallback content map for apps that have hardcoded legal docs
const FALLBACK_CONTENT: Record<string, Record<LegalDocumentType, string | null>> = {
    keevio: {
        privacy_policy: keevioPrivacyPolicy,
        terms_of_use: keevioTermsOfUse,
    },
    memolib: {
        privacy_policy: memolibPrivacyPolicy,
        terms_of_use: memolibTermsOfUse,
    },
    general: {
        privacy_policy: generalPrivacyPolicy,
        terms_of_use: generalTermsOfUse,
    },
};

interface RouteParams {
    params: Promise<{ slug: string; type: string }>;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { slug, type } = await params;

    // Validate type parameter
    if (!VALID_TYPES.includes(type as LegalDocumentType)) {
        return NextResponse.json(
            {
                error: "Invalid document type",
                message: `Type must be one of: ${VALID_TYPES.join(", ")}`,
            },
            { status: 400, headers: corsHeaders }
        );
    }

    const docType = type as LegalDocumentType;

    try {
        // Look up app by slug (skip DB lookup for "general")
        const appData = slug !== "general"
            ? await fetchQuery(api.apps.queries.getBySlug, { slug }).catch(() => null)
            : null;

        if (slug !== "general" && !appData) {
            return NextResponse.json(
                { error: "App not found", message: `No app found with slug "${slug}"` },
                { status: 404, headers: corsHeaders }
            );
        }

        const appName = slug === "general"
            ? "NorthByte Studio"
            : appData?.name ?? slug;

        // 1. Try DB-stored content (markdown)
        const dbField = docType === "privacy_policy" ? "privacyPolicy" : "termsOfUse";
        const dbContent = appData?.[dbField];

        if (dbContent) {
            return NextResponse.json({
                appName,
                slug,
                type: docType,
                content: dbContent,
                contentType: "markdown",
            }, { headers: corsHeaders });
        }

        // 2. Try hardcoded fallback (HTML)
        const fallback = FALLBACK_CONTENT[slug]?.[docType];

        if (fallback) {
            return NextResponse.json({
                appName,
                slug,
                type: docType,
                content: fallback,
                contentType: "html",
            }, { headers: corsHeaders });
        }

        // 3. No content found
        return NextResponse.json(
            {
                error: "Document not found",
                message: `No ${docType.replace("_", " ")} found for "${appName}"`,
            },
            { status: 404, headers: corsHeaders }
        );
    } catch (error) {
        console.error("Error fetching legal document:", error);
        return NextResponse.json(
            { error: "Internal server error", message: "Failed to fetch legal document" },
            { status: 500, headers: corsHeaders }
        );
    }
}
