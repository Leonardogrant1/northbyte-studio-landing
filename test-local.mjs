// Vergleicht Original und Fixed Version einer lokalen MP4-Datei
// Run: node test-local.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';

function checkFile(path) {
    if (!existsSync(path)) {
        console.log(`❌ Datei nicht gefunden: ${path}`);
        return;
    }

    const buffer = readFileSync(path);
    console.log(`Datei: ${path}`);
    console.log(`Größe: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`First 12 bytes (hex): ${buffer.slice(0, 12).toString('hex')}`);

    const ftyp = buffer.slice(4, 8).toString('ascii');
    console.log(`Bytes 4-8 (ftyp?): "${ftyp}"`);

    if (ftyp !== 'ftyp') {
        console.log('Kein ftyp-Box gefunden — kein Standard-MP4');
        return;
    }

    const brand = buffer.slice(8, 12).toString('ascii');
    console.log(`MP4 brand (bytes 8-12): "${brand}"`);
    console.log('\nBekannte Brands:');
    console.log('  isom, iso2, mp41, mp42 → video/mp4 ✅');
    console.log('  qt   → video/quicktime ❌ (nicht in Postiz Allowlist)');
    console.log('  M4V  → video/x-m4v ❌ (nicht in Postiz Allowlist)');
    console.log('  heic, hevl → HEVC ❌');

    const isAllowed = ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'iso4', 'iso5', 'iso6'].includes(brand.trim());
    console.log(`\nBrand "${brand}" → ${isAllowed ? '✅ wahrscheinlich video/mp4' : '❌ wahrscheinlich NICHT video/mp4'}`);
}

// --- Original ---
console.log('='.repeat(50));
console.log('ORIGINAL');
console.log('='.repeat(50));
checkFile('15.mp4');

// --- Patch ---
console.log('\n' + '='.repeat(50));
console.log('PATCH (normalizeVideoFile Simulation)');
console.log('='.repeat(50));

const original = readFileSync('15.mp4');
const patched = Buffer.from(original);
patched[8]  = 0x69; // i
patched[9]  = 0x73; // s
patched[10] = 0x6f; // o
patched[11] = 0x6d; // m
writeFileSync('15_fixed.mp4', patched);

checkFile('15_fixed.mp4');
