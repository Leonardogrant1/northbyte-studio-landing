import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import pino from 'pino';

const logger = pino();

export interface OverlayOptions {
    // Position in video (0-100%)
    startPercent?: number;
    endPercent?: number;

    // Position on screen - use preset or custom x/y
    position?: 'top_left' | 'top_center' | 'top_right' | 'center_left' | 'center' | 'center_right' | 'bottom_left' | 'bottom_center' | 'bottom_right';
    x?: string; // e.g., '10', 'center', 'right-10' (overrides position)
    y?: string; // e.g., '10', 'center', 'bottom-10' (overrides position)

    // Size
    width?: number;
    height?: number;

    // Opacity (0-1)
    opacity?: number;
}

export interface ImageOverlay {
    imageUrl: string;
    startPercent?: number;
    endPercent?: number;
    position?: 'top_left' | 'top_center' | 'top_right' | 'center_left' | 'center' | 'center_right' | 'bottom_left' | 'bottom_center' | 'bottom_right';
    x?: string;
    y?: string;
    width?: number;
    height?: number;
    opacity?: number;
}

/**
 * Overlays multiple PNG images onto a video using FFmpeg
 */
export async function overlayImagesOnVideo(
    videoPath: string,
    imagePaths: string[],
    outputPath: string,
    overlays: OverlayOptions[]
): Promise<void> {
    return new Promise((resolve, reject) => {
        // Get video duration first
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                return reject(new Error(`Failed to probe video: ${err.message}`));
            }

            const duration = metadata.format.duration || 0;

            // Build overlay filters for each image - chain them together
            const filterComplex: string[] = [];
            let previousOutput = '[0:v]'; // Start with the video input

            overlays.forEach((options, index) => {
                const startPercent = options.startPercent ?? 0;
                const endPercent = options.endPercent ?? 100;

                const startTime = (duration * startPercent) / 100;
                const endTime = (duration * endPercent) / 100;

                const inputIndex = index + 1; // +1 because input 0 is video
                const currentOutput = index === overlays.length - 1 ? '' : `[v${index}]`; // Last one doesn't need output label

                // Build the filter for this image (scaling, opacity)
                const imageFilter = buildImageFilter(options, inputIndex);
                filterComplex.push(imageFilter);

                // Build overlay filter
                let overlayFilter = `${previousOutput}[img${inputIndex}]overlay`;

                // Add position
                const { x: posX, y: posY } = getPositionFromOptions(options);
                const x = parsePosition(posX, 'W', 'w');
                const y = parsePosition(posY, 'H', 'h');
                overlayFilter += `=${x}:${y}`;

                // Add timing if not full video
                if (startPercent > 0 || endPercent < 100) {
                    overlayFilter += `:enable='between(t,${startTime},${endTime})'`;
                }

                // Add output label if not last
                if (currentOutput) {
                    overlayFilter += currentOutput;
                }

                filterComplex.push(overlayFilter);
                previousOutput = currentOutput || previousOutput; // Use current output for next iteration

                logger.info(`Overlay ${index + 1}: ${startPercent}% to ${endPercent}% (${startTime.toFixed(2)}s to ${endTime.toFixed(2)}s)`);
            });

            logger.info(`Total overlays: ${overlays.length}`);
            logger.info(`Filter complex: ${JSON.stringify(filterComplex)}`);

            const command = ffmpeg()
                .input(videoPath);

            // Add all image inputs
            imagePaths.forEach(imagePath => {
                command.input(imagePath);
            });

            // Apply all overlay filters
            command
                .complexFilter(filterComplex)
                .outputOptions([
                    '-c:v libx264',
                    '-preset fast',
                    '-c:a copy',
                ])
                .output(outputPath);

            command
                .on('start', (commandLine) => {
                    logger.info({ commandLine }, 'FFmpeg command');
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        logger.info(`Processing: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', () => {
                    logger.info('Image overlay completed');
                    resolve();
                })
                .on('error', (err) => {
                    logger.error({ err }, 'FFmpeg error');
                    reject(new Error(`Failed to overlay image: ${err.message}`));
                })
                .run();
        });
    });
}

/**
 * Converts position preset to x/y coordinates
 */
function getPositionFromOptions(options: OverlayOptions): { x: string; y: string } {
    // Custom x/y overrides position preset
    if (options.x !== undefined || options.y !== undefined) {
        return {
            x: options.x || '0',
            y: options.y || '0',
        };
    }

    // Use position preset
    const position = options.position || 'top_left';

    const positionMap: Record<string, { x: string; y: string }> = {
        'top_left': { x: '10', y: '10' },
        'top_center': { x: 'center', y: '10' },
        'top_right': { x: 'right-10', y: '10' },
        'center_left': { x: '10', y: 'center' },
        'center': { x: 'center', y: 'center' },
        'center_right': { x: 'right-10', y: 'center' },
        'bottom_left': { x: '10', y: 'bottom-10' },
        'bottom_center': { x: 'center', y: 'bottom-10' },
        'bottom_right': { x: 'right-10', y: 'bottom-10' },
    };

    return positionMap[position] || { x: '0', y: '0' };
}

/**
 * Builds the image processing filter (scaling, opacity) without overlay
 */
function buildImageFilter(options: OverlayOptions, inputIndex: number): string {
    let filter = `[${inputIndex}:v]`;

    // Add scaling if width/height specified
    if (options.width || options.height) {
        const width = options.width || -1;
        const height = options.height || -1;
        filter += `scale=${width}:${height}`;
    }

    // Add opacity if specified
    if (options.opacity !== undefined && options.opacity < 1) {
        if (options.width || options.height) {
            filter += ','; // Add comma if we already have scale
        }
        filter += `format=rgba,colorchannelmixer=aa=${options.opacity}`;
    }

    filter += `[img${inputIndex}]`; // Output label for this processed image (no semicolon)
    return filter;
}

/**
 * Parses position string (e.g., 'center', 'right-10', '50')
 */
function parsePosition(pos: string, mainDim: string, overlayDim: string): string {
    if (pos === 'center') {
        return `(${mainDim}-${overlayDim})/2`;
    }

    if (pos.startsWith('right-') || pos.startsWith('bottom-')) {
        const offset = pos.split('-')[1];
        return `${mainDim}-${overlayDim}-${offset}`;
    }

    if (pos === 'right' || pos === 'bottom') {
        return `${mainDim}-${overlayDim}`;
    }

    // Default: treat as pixel value
    return pos;
}
