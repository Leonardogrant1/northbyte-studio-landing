const RC_BASE = "https://api.revenuecat.com/v2";

const rcCache = new Map<string, { data: unknown; expires: number }>();

export async function rcFetch(path: string, apiKey: string, revalidate = 300) {
    const now = Date.now();
    const hit = rcCache.get(path);
    if (hit && hit.expires > now) return hit.data;

    const res = await fetch(`${RC_BASE}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) throw new Error(`RC ${path} → ${res.status}`);
    const data = await res.json();
    rcCache.set(path, { data, expires: now + revalidate * 1000 });
    return data;
}
