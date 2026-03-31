export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:3" | "3:4";
export type ImageSize = "1K" | "2K" | "4K";

export interface NanobanaImage {
    /** Base64-encoded image data */
    data: string;
    mimeType: string;
}

export interface NanobanaGenerateParams {
    prompt: string;
    /** Up to 5 reference images as base64 strings with their mime types */
    referenceImages?: Array<{ data: string; mimeType: string }>;
    /** Optional avatar reference image — sent first, does not count toward the 5-image limit */
    avatarImage?: { data: string; mimeType: string };
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
}

export interface NanobanaGenerateResult {
    /** Base64-encoded result image */
    data: string;
    mimeType: string;
    /** Convenience data URL ready for <img src> */
    dataUrl: string;
}

// ── Response shape ─────────────────────────────────────────────────────────────

interface NanobanaResponsePart {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface NanobanaResponse {
    candidates: Array<{
        content: {
            parts: NanobanaResponsePart[];
        };
    }>;
}

// ── Wrapper ────────────────────────────────────────────────────────────────────

export class NanobanaClient {
    private readonly apiUrl: string;
    private readonly apiKey: string;

    constructor(apiUrl?: string, apiKey?: string) {
        this.apiUrl = apiUrl ?? process.env.NANOBANA_API_URL ?? "";
        this.apiKey = apiKey ?? process.env.NANOBANA_API_KEY ?? "";

        console.log("apiUrl", this.apiUrl);
        console.log("apiKey", this.apiKey);

        if (!this.apiUrl) throw new Error("NANOBANA_API_URL is not set.");
        if (!this.apiKey) throw new Error("NANOBANA_API_KEY is not set.");
    }

    async generateImage(params: NanobanaGenerateParams): Promise<NanobanaGenerateResult> {
        const { prompt, referenceImages = [], avatarImage, aspectRatio = "9:16", imageSize = "2K" } = params;

        if (referenceImages.length > 5) {
            throw new Error("Maximum 5 reference images allowed.");
        }

        const parts: object[] = [{ text: prompt }];

        if (avatarImage) {
            parts.push({ inline_data: { mime_type: avatarImage.mimeType, data: avatarImage.data } });
        }

        for (const img of referenceImages) {
            parts.push({
                inline_data: {
                    mime_type: img.mimeType,
                    data: img.data,
                },
            });
        }

        const body = {
            contents: [{ parts }],
            generationConfig: {
                imageConfig: {
                    aspectRatio,
                    imageSize,
                },
            },
        };

        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            throw new Error(`Nanobana API error ${response.status}: ${text}`);
        }

        const json: NanobanaResponse = await response.json();

        const imagePart = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (!imagePart?.inlineData) {
            throw new Error("No image returned from Nanobana API.");
        }

        const { data, mimeType } = imagePart.inlineData;
        return {
            data,
            mimeType,
            dataUrl: `data:${mimeType};base64,${data}`,
        };
    }
}

/** Singleton for server-side use (API routes / server actions) */
export const nanobana = new NanobanaClient();
