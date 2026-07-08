import { GoogleAuth } from 'google-auth-library';
import pino from 'pino';

const logger = pino();

let auth: GoogleAuth | null = null;

/**
 * Initializes Google Auth with service account credentials from environment variable
 */
function initializeAuth(): GoogleAuth {
    if (auth) {
        return auth;
    }

    const serviceAccountB64 = process.env.SERVICE_ACCOUNT_B64;

    if (!serviceAccountB64) {
        throw new Error('SERVICE_ACCOUNT_B64 environment variable is required');
    }

    try {
        // Decode base64 service account key
        const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('utf-8');
        const credentials = JSON.parse(serviceAccountJson);

        // Initialize Google Auth with credentials
        auth = new GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        logger.info('Google Auth initialized successfully');
        return auth;
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to initialize Google Auth');
        throw new Error('Failed to initialize Google Auth: ' + error.message);
    }
}

/**
 * Gets an access token for Google Cloud API requests
 */
export async function getAccessToken(): Promise<string> {
    try {
        const authClient = initializeAuth();
        const client = await authClient.getClient();
        const accessTokenResponse = await client.getAccessToken();

        if (!accessTokenResponse.token) {
            throw new Error('Failed to get access token');
        }

        return accessTokenResponse.token;
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to get access token');
        throw error;
    }
}

/**
 * Gets the project ID from the service account credentials
 */
export function getProjectId(): string {
    const serviceAccountB64 = process.env.SERVICE_ACCOUNT_B64;

    if (!serviceAccountB64) {
        throw new Error('SERVICE_ACCOUNT_B64 environment variable is required');
    }

    try {
        const serviceAccountJson = Buffer.from(serviceAccountB64, 'base64').toString('utf-8');
        const credentials = JSON.parse(serviceAccountJson);
        return credentials.project_id;
    } catch (error: any) {
        logger.error({ error: error.message }, 'Failed to get project ID');
        throw new Error('Failed to get project ID: ' + error.message);
    }
}
