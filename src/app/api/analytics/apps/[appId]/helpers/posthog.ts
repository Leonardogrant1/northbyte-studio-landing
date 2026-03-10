const PH_BASE = process.env.POSTHOG_HOST ?? "https://eu.posthog.com";

const phCache = new Map<string, { data: unknown; expires: number }>();

export async function phFetch(path: string, apiKey: string, body: object, revalidate = 300) {
    const cacheKey = `${path}:${JSON.stringify(body)}`;
    const now = Date.now();
    const hit = phCache.get(cacheKey);
    if (hit && hit.expires > now) return hit.data;

    const res = await fetch(`${PH_BASE}${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`PH ${path} → ${res.status}`);
    const data = await res.json();
    phCache.set(cacheKey, { data, expires: now + revalidate * 1000 });
    return data;
}
