const API_BASE = "https://api-singapore.klingai.com/v1/videos";

function getKlingApiKey(): string {
    const key = process.env.KLING_API_KEY;
    if (!key) throw new Error("KLING_API_KEY is not set.");
    return key;
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
    const key = getKlingApiKey();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
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
    return klingRequest<KlingTaskData>("/motion-control", {
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
    return klingRequest<KlingTaskData>(`/motion-control/${taskId}`);
}

// ── Video Generation ───────────────────────────────────────────────────────────

export type KlingVgDuration = "5" | "10";
export type KlingVgAspectRatio = "9:16" | "16:9" | "1:1";
export type KlingVgSound = "on" | "off";
export type KlingVgType = "text" | "image";

export interface KlingText2VideoParams {
    model_name?: KlingModelName;
    prompt: string;
    negative_prompt?: string;
    duration?: KlingVgDuration;
    mode?: KlingMode;
    sound?: KlingVgSound;
    aspect_ratio?: KlingVgAspectRatio;
}

export interface KlingImage2VideoParams {
    model_name?: KlingModelName;
    prompt?: string;
    negative_prompt?: string;
    image?: string;       // raw base64 (no data: prefix) or URL
    image_tail?: string;  // optional end frame
    duration?: KlingVgDuration;
    mode?: KlingMode;
    sound?: KlingVgSound;
}

export async function createText2VideoTask(params: KlingText2VideoParams): Promise<KlingTaskData> {
    return klingRequest<KlingTaskData>("/text2video", {
        method: "POST",
        body: JSON.stringify({
            model_name: params.model_name ?? "kling-v2-6",
            prompt: params.prompt,
            negative_prompt: params.negative_prompt ?? "",
            duration: params.duration ?? "5",
            mode: params.mode ?? "std",
            sound: params.sound ?? "on",
            aspect_ratio: params.aspect_ratio ?? "9:16",
            callback_url: "",
            external_task_id: "",
        }),
    });
}

export async function createImage2VideoTask(params: KlingImage2VideoParams): Promise<KlingTaskData> {
    return klingRequest<KlingTaskData>("/image2video", {
        method: "POST",
        body: JSON.stringify({
            model_name: params.model_name ?? "kling-v2-6",
            prompt: params.prompt ?? "",
            negative_prompt: params.negative_prompt ?? "",
            image: params.image,
            image_tail: params.image_tail,
            duration: params.duration ?? "5",
            mode: params.mode ?? "std",
            sound: params.sound ?? "on",
            callback_url: "",
            external_task_id: "",
        }),
    });
}

export async function getVideoGenTask(taskId: string, type: KlingVgType): Promise<KlingTaskData> {
    const path = type === "text" ? "/text2video" : "/image2video";
    return klingRequest<KlingTaskData>(`${path}/${taskId}`);
}
