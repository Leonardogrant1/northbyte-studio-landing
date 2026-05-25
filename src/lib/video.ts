/**
 * Normalizes a video file for upload.
 *
 * CapCut (and some other Mac apps) export H.264 videos in a QuickTime container
 * with ftyp major brand "qt  " instead of the standard "isom". The file-type
 * library (used by Postiz) detects "qt  " as video/quicktime, which is rejected.
 *
 * Fix: patch the 4 brand bytes in the ftyp box from "qt  " to "isom".
 * The actual video/audio data is untouched — no re-encoding, no quality loss.
 */
export async function normalizeVideoFile(file: File): Promise<File> {
    // Read just the first 20 bytes — enough to inspect the ftyp box
    const header = new Uint8Array(await file.slice(0, 20).arrayBuffer());

    // Verify ftyp box: bytes 4–7 must be "ftyp" (0x66 0x74 0x79 0x70)
    const isFtyp =
        header[4] === 0x66 &&
        header[5] === 0x74 &&
        header[6] === 0x79 &&
        header[7] === 0x70;

    if (!isFtyp) return file;

    // Read major brand: bytes 8–11
    const brand = String.fromCharCode(header[8], header[9], header[10], header[11]);

    // Only patch QuickTime brand — everything else is fine as-is
    if (brand !== "qt  ") return file;

    // Read full file, patch brand bytes 8–11 from "qt  " to "isom"
    const patched = new Uint8Array(await file.arrayBuffer());
    patched[8]  = 0x69; // i
    patched[9]  = 0x73; // s
    patched[10] = 0x6f; // o
    patched[11] = 0x6d; // m

    return new File([patched], file.name, { type: file.type });
}
