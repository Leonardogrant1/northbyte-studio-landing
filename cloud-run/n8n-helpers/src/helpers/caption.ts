import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { createCanvas } from 'canvas';

export async function generateCaptionPNG(caption: string, outputPath: string): Promise<void> {
    const canvas = createCanvas(1920, 300);
    const ctx = canvas.getContext('2d');

    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set font - TikTok style with extra bold weight
    // DejaVu Sans is installed in Docker, with fallbacks for local development
    // Added Noto Color Emoji and Apple Color Emoji for emoji support
    ctx.font = '900 28px "DejaVu Sans", "Helvetica Neue", "Arial Rounded MT Bold", Arial, "Noto Color Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Split text into lines with max characters per line
    const maxCharsPerLine = 35; // Max characters per line
    const maxWidth = 800; // Much narrower
    const words = caption.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    let currentCharCount = 0;

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testCharCount = currentCharCount + word.length + (currentLine ? 1 : 0);
        const metrics = ctx.measureText(testLine);

        // Break line if too many chars or too wide
        if ((testCharCount > maxCharsPerLine || metrics.width > maxWidth) && currentLine) {
            lines.push(currentLine);
            currentLine = word;
            currentCharCount = word.length;
        } else {
            currentLine = testLine;
            currentCharCount = testCharCount;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }

    // Calculate dimensions - much smaller
    const lineHeight = 38;
    const padding = 18;
    const boxHeight = lines.length * lineHeight + padding * 2;
    const boxWidth = Math.min(1500, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 4);
    const boxX = (canvas.width - boxWidth) / 2;
    const boxY = 40; // Position at top
    const radius = 20;

    // Draw white speech bubble with rounded corners (no arrow)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxWidth - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
    ctx.lineTo(boxX + radius, boxY + boxHeight);
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();

    // Add subtle shadow/stroke
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw black text (no stroke for cleaner look)
    ctx.fillStyle = 'black';
    const startY = boxY + padding + lineHeight / 2;

    lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
    });

    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
}

export async function renderCaptionOnVideo(
    videoPath: string,
    caption: string,
    outputPath: string,
    isPng: boolean
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (isPng) {
            // Generate PNG overlay
            const pngPath = path.join(path.dirname(outputPath), 'caption.png');
            generateCaptionPNG(caption, pngPath)
                .then(() => {
                    ffmpeg(videoPath)
                        .input(pngPath)
                        .complexFilter([
                            '[1:v]scale=1920:-1[overlay]',
                            '[0:v][overlay]overlay=(W-w)/2:130'
                        ])
                        .outputOptions(['-c:a copy'])
                        .output(outputPath)
                        .on('end', () => {
                            fs.unlinkSync(pngPath);
                            resolve();
                        })
                        .on('error', (err) => {
                            if (fs.existsSync(pngPath)) {
                                fs.unlinkSync(pngPath);
                            }
                            reject(err);
                        })
                        .run();
                })
                .catch(reject);
        } else {
            // Use drawtext filter - escape special characters for ffmpeg
            const escapedCaption = caption
                .replace(/\\/g, '\\\\\\\\')  // Escape backslashes
                .replace(/'/g, "'\\\\\\\\''")  // Escape single quotes
                .replace(/:/g, '\\\\:');       // Escape colons

            const filterString = `drawtext=text='${escapedCaption}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=20`;

            ffmpeg(videoPath)
                .outputOptions([
                    '-vf', filterString,
                    '-c:a', 'copy'
                ])
                .output(outputPath)
                .on('end', () => resolve())
                .on('error', reject)
                .run();
        }
    });
}
