// Simuliert exakt die Postiz-Erkennung (uploadSimple / fromBuffer)
// Run: node test-postiz.mjs

import { readFileSync } from 'fs';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'image/bmp', 'image/tiff',
    'video/mp4',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
]);

async function check(path) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Datei: ${path}`);
    console.log('='.repeat(50));

    const buffer = readFileSync(path);
    console.log(`Größe: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    const detected = await fileTypeFromBuffer(buffer);
    console.log(`file-type Ergebnis:`, detected);

    if (!detected) {
        console.log('❌ Postiz: file-type konnte Typ nicht erkennen → "Unsupported file type."');
    } else if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
        console.log(`❌ Postiz: "${detected.mime}" nicht in Allowlist → "Unsupported file type."`);
    } else {
        console.log(`✅ Postiz: "${detected.mime}" erlaubt → Upload würde klappen`);
    }
}

await check('15.mp4');
await check('15_fixed.mp4');
