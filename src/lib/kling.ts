const JWT_ENDPOINT = "https://n8n-helpers-38873740272.europe-west3.run.app/kling/create-jwt";
const BASE_URL = "https://api-singapore.klingai.com/v1/videos/motion-control";

// ── JWT cache (server-side in-memory) ─────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function fetchJwt(): Promise<string> {
    const password = process.env.KLING_JWT_PASSWORD;
    if (!password) throw new Error("KLING_JWT_PASSWORD is not set.");

    const res = await fetch(JWT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`Kling JWT error ${res.status}: ${text}`);
    }

    const data = await res.json();

    console.log(data)
    const token: string = data.authorization;
    if (!token) throw new Error("No token returned from Kling JWT endpoint.");
    return token;
}

/** Returns a valid JWT, re-fetching only when expired or missing. */
export async function getKlingJwt(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) return cachedToken;

    const token = await fetchJwt();
    cachedToken = token;
    // Cache for 50 minutes (JWTs typically valid 1h)
    tokenExpiresAt = now + 50 * 60 * 1000;
    return token;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type KlingModelName = "kling-v2-6" | "kling-v3";
export type KlingMode = "std" | "pro";
export type CharacterOrientation = "video" | "image";
export type KeepOriginalSound = "yes" | "no";
export type KlingTaskStatus = "submitted" | "processing" | "succeed" | "failed";

export interface KlingMotionControlParams {
    prompt?: string;
    image_url: string;          // URL or raw base64 (no data: prefix)
    video_url: string;
    model_name?: KlingModelName;
    mode?: KlingMode;
    keep_original_sound?: KeepOriginalSound;
    character_orientation?: CharacterOrientation;
}

export interface KlingVideo {
    id: string;
    url: string;
    watermark_url?: string;
    duration?: string;
}

export interface KlingTaskData {
    task_id: string;
    task_status: KlingTaskStatus;
    task_status_msg?: string;
    task_result?: { videos?: KlingVideo[] };
    created_at: number;
    updated_at: number;
}

interface KlingApiResponse<T> {
    code: number;
    message: string;
    request_id: string;
    data: T;
}

async function klingRequest<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const jwt = await getKlingJwt();
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
            ...(options.headers ?? {}),
        },
    });

    const json: KlingApiResponse<T> = await res.json();

    if (!res.ok || json.code !== 0) {
        throw new Error(`Kling API error (${json.code}): ${json.message}`);
    }

    return json.data;
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export async function createMotionControlTask(
    params: KlingMotionControlParams
): Promise<KlingTaskData> {
    return klingRequest<KlingTaskData>("", {
        method: "POST",
        body: JSON.stringify({
            model_name: params.model_name ?? "kling-v2-6",
            prompt: params.prompt ?? "",
            image_url: params.image_url,
            video_url: params.video_url,
            keep_original_sound: params.keep_original_sound ?? "yes",
            character_orientation: params.character_orientation ?? "video",
            mode: params.mode ?? "std",
        }),
    });
}

export async function getMotionControlTask(taskId: string): Promise<KlingTaskData> {
    return klingRequest<KlingTaskData>(`/${taskId}`);
}
