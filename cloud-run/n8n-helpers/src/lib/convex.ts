import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

let client: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
    if (!client) {
        const url = process.env.CONVEX_URL;
        if (!url) {
            throw new Error('CONVEX_URL environment variable is required');
        }
        client = new ConvexHttpClient(url);
    }
    return client;
}

export interface SocialAccount {
    _id: string;
    platform: string;
    username: string;
    postizId?: string;
    avatarId?: string;
    postingTimes?: string[];
    timezone?: string;
    assignedTo?: string;
}

export interface AiAvatar {
    _id: string;
    name: string;
    imageUrl: string;
    description: string;
}

export interface ScheduledPost {
    scheduledAt?: number;
}

export async function getById<T>(id: string): Promise<T | null> {
    return await getConvexClient().query(anyApi.generic.queries.getById, { id });
}

export async function getLastScheduledPosts(
    accountId: string,
    limit = 10
): Promise<ScheduledPost[]> {
    return await getConvexClient().query(anyApi.posts.queries.getLastScheduledByAccount, {
        accountId,
        limit,
    });
}

export async function createPostFromService(args: {
    title: string;
    description?: string;
    mediaUrls: string[];
    accountId: string;
    scheduledAt?: number;
    postizPostId?: string;
}): Promise<string> {
    const internalKey = process.env.INTERNAL_API_SECRET;
    if (!internalKey) {
        throw new Error('INTERNAL_API_SECRET environment variable is required');
    }
    return await getConvexClient().mutation(anyApi.posts.mutations.createFromService, {
        internalKey,
        ...args,
    });
}
