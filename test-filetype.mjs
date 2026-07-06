// Test script: prüft was file-type aus der R2-URL erkennt
// Run: node test-filetype.mjs <url>
// Beispiel: node test-filetype.mjs "https://n8n-media.northbyte.studio/videos/6d1ab8aa-2f44-4b32-810a-dfa0ff4661ff.mp4"

const url = process.argv[2];
if (!url) {
    console.error('Usage: node test-filetype.mjs <url>');
    process.exit(1);
}

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
    'image/bmp', 'image/tiff',
    'video/mp4',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
]);

console.log(`Fetching: ${url}`);
const res = await fetch(url);
console.log(`HTTP Status: ${res.status}`);
console.log(`Content-Type header: ${res.headers.get('content-type')}`);
console.log(`Content-Length: ${res.headers.get('content-length')} bytes`);

// Nur die ersten 4100 Bytes lesen — file-type braucht nur die Magic Bytes
const reader = res.body.getReader();
const chunks = [];
let totalRead = 0;
const SAMPLE_SIZE = 4100;

while (totalRead < SAMPLE_SIZE) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalRead += value.length;
}
reader.cancel();

const buffer = Buffer.concat(chunks).slice(0, SAMPLE_SIZE);
console.log(`\nRead ${buffer.length} bytes for detection`);

// file-type dynamisch importieren (ESM)
const { fileTypeFromBuffer } = await import('file-type').catch(() => null) ?? {};

if (!fileTypeFromBuffer) {
    // Fallback: manuelle Magic-Byte Analyse
    console.log('\nfile-type nicht installiert — manuelle Analyse:');
    const hex = buffer.slice(0, 12).toString('hex');
    console.log(`First 12 bytes (hex): ${hex}`);

    // MP4 ftyp box check (bytes 4-7 = "ftyp")
    const ftyp = buffer.slice(4, 8).toString('ascii');
    console.log(`Bytes 4-8 (ftyp?): "${ftyp}"`);

    if (ftyp === 'ftyp') {
        const brand = buffer.slice(8, 12).toString('ascii');
        console.log(`MP4 brand (bytes 8-12): "${brand}"`);
        console.log('\nBekannte Brands:');
        console.log('  isom, iso2, mp41, mp42 → video/mp4 ✅');
        console.log('  qt   → video/quicktime ❌ (nicht in Postiz Allowlist)');
        console.log('  M4V  → video/x-m4v ❌ (nicht in Postiz Allowlist)');
        console.log('  heic, hevl → HEVC ❌');

        const isAllowed = ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'iso4', 'iso5', 'iso6'].includes(brand.trim());
        console.log(`\nBrand "${brand}" → ${isAllowed ? '✅ wahrscheinlich video/mp4' : '❌ wahrscheinlich NICHT video/mp4'}`);
    } else {
        console.log('Kein ftyp-Box gefunden — kein Standard-MP4');
    }
} else {
    const detected = await fileTypeFromBuffer(buffer);
    console.log('\nfile-type Ergebnis:', detected);
    if (!detected) {
        console.log('❌ file-type konnte den Typ nicht erkennen');
    } else if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
        console.log(`❌ "${detected.mime}" ist NICHT in Postiz Allowlist → "Unsupported file type."`);
    } else {
        console.log(`✅ "${detected.mime}" ist erlaubt`);
    }
}
