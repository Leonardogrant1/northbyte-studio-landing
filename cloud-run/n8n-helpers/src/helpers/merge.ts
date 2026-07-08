import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

export async function mergeVideos(inputPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Create a concat file for ffmpeg
        const concatFilePath = path.join(path.dirname(outputPath), 'concat.txt');
        const concatContent = inputPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatFilePath, concatContent);

        ffmpeg()
            .input(concatFilePath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(outputPath)
            .on('end', () => {
                // Clean up concat file
                fs.unlinkSync(concatFilePath);
                resolve();
            })
            .on('error', (err) => {
                // Clean up concat file
                if (fs.existsSync(concatFilePath)) {
                    fs.unlinkSync(concatFilePath);
                }
                reject(err);
            })
            .run();
    });
}
