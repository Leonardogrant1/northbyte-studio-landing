import crypto from 'crypto';

export function encodeJwtToken(ak: string, sk: string) {
    const now = Math.floor(Date.now() / 1000);

    const header = {
        alg: "HS256",
        typ: "JWT"
    };

    const payload = {
        iss: ak,
        exp: now + 1800,  // Current time + 30min
        nbf: now - 5      // Current time - 5s
    };

    // Base64url encode
    const base64Header = Buffer.from(JSON.stringify(header))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const base64Payload = Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const signingInput = `${base64Header}.${base64Payload}`;

    // HMAC-SHA256 signature

    const signature = crypto
        .createHmac('sha256', sk)
        .update(signingInput)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${signingInput}.${signature}`;
}