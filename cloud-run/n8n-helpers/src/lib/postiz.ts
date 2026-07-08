import axios from 'axios';

function postizConfig(): { apiKey: string; baseUrl: string } {
    const apiKey = process.env.POSTIZ_API_KEY;
    if (!apiKey) {
        throw new Error('POSTIZ_API_KEY environment variable is required');
    }
    const baseUrl = process.env.POSTIZ_BASE_URL ?? 'https://api.postiz.com/public/v1';
    return { apiKey, baseUrl };
}

export interface PostizMedia {
    id: string;
    path: string;
}

// Gleiche TikTok-Defaults wie die Web-App (post-content page)
const TIKTOK_SETTINGS = {
    __type: 'tiktok',
    privacy_level: 'PUBLIC_TO_EVERYONE',
    duet: true,
    stitch: true,
    comment: true,
    autoAddMusic: 'no',
    brand_content_toggle: false,
    brand_organic_toggle: false,
    content_posting_method: 'DIRECT_POST',
    video_made_with_ai: false,
};

export async function uploadFromUrl(url: string): Promise<PostizMedia> {
    const { apiKey, baseUrl } = postizConfig();
    const res = await axios.post(
        `${baseUrl}/upload-from-url`,
        { url },
        { headers: { Authorization: apiKey } }
    );
    const { id, path } = res.data ?? {};
    if (!id || !path) {
        throw new Error(`Postiz upload-from-url returned no media: ${JSON.stringify(res.data)}`);
    }
    return { id, path };
}

export async function createPost(params: {
    integrationId: string;
    platform: string;
    content: string;
    media: PostizMedia[];
    scheduledAt?: string; // ISO string; omitted → post now
}): Promise<string | undefined> {
    const { apiKey, baseUrl } = postizConfig();

    const settings =
        params.platform === 'tiktok' ? TIKTOK_SETTINGS : { __type: params.platform };

    const payload = {
        type: params.scheduledAt ? 'schedule' : 'now',
        date: params.scheduledAt ?? new Date().toISOString(),
        shortLink: false,
        tags: [],
        posts: [
            {
                integration: { id: params.integrationId },
                value: [
                    {
                        content: params.content,
                        image: params.media.map(({ id, path }) => ({ id, path })),
                    },
                ],
                settings,
            },
        ],
    };

    const res = await axios.post(`${baseUrl}/posts`, payload, {
        headers: { Authorization: apiKey },
    });
    return res.data?.id ?? res.data?.[0]?.id;
}
