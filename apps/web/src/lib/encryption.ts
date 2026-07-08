import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
    const hex = process.env.ANALYTICS_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error("ANALYTICS_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
    }
    return Buffer.from(hex, "hex");
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string: `iv:authTag:ciphertext` (all hex).
 */
export function encrypt(text: string): string {
    const key = getKey();
    const iv = randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a string produced by `encrypt`.
 */
export function decrypt(encoded: string): string {
    const key = getKey();
    const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");
    if (!ivHex || !authTagHex || !ciphertextHex) throw new Error("Invalid encrypted format");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
