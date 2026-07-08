import axios from 'axios';
import * as fs from 'fs';
import pino from 'pino';

const logger = pino();

/**
 * ASS subtitle file format parser and modifier
 */

export interface AssDialogueLine {
    layer: string;
    start: string;
    end: string;
    style: string;
    name: string;
    marginL: string;
    marginR: string;
    marginV: string;
    effect: string;
    text: string;
}

export interface AssFile {
    header: string;
    dialogues: AssDialogueLine[];
}

/**
 * Downloads an ASS file from a URL
 */
export async function downloadAssFile(url: string): Promise<string> {
    const response = await axios.get(url, { responseType: 'text' });
    return response.data;
}

/**
 * Parses an ASS subtitle file content
 * Supports both full ASS format and simplified format with only Dialogue lines
 */
export function parseAssFile(content: string): AssFile {
    const lines = content.split('\n');
    const dialogues: AssDialogueLine[] = [];

    // Check if this is a simplified format (only Dialogue lines, no header)
    const hasHeader = lines.some(line => line.trim().startsWith('['));

    if (!hasHeader) {
        // Simplified format: only Dialogue lines
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('Dialogue:')) {
                const dialogue = parseDialogueLine(trimmed);
                if (dialogue) {
                    dialogues.push(dialogue);
                }
            }
        }

        // No header for simplified format - preserve original format
        return { header: '', dialogues };
    }

    // Full ASS format with header
    let headerEndIndex = 0;

    // Find the [Events] section
    const eventsIndex = lines.findIndex(line => line.trim() === '[Events]');
    if (eventsIndex === -1) {
        throw new Error('Invalid ASS file: [Events] section not found');
    }

    // Find the Format line in Events section
    let formatIndex = -1;
    for (let i = eventsIndex + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith('Format:')) {
            formatIndex = i;
            break;
        }
    }

    if (formatIndex === -1) {
        throw new Error('Invalid ASS file: Format line not found in [Events] section');
    }

    // Parse dialogue lines
    for (let i = formatIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('Dialogue:')) {
            const dialogue = parseDialogueLine(line);
            if (dialogue) {
                dialogues.push(dialogue);
            }
        }
    }

    // Header is everything before the first dialogue line
    const firstDialogueIndex = lines.findIndex(line => line.trim().startsWith('Dialogue:'));
    headerEndIndex = firstDialogueIndex > 0 ? firstDialogueIndex : lines.length;
    const header = lines.slice(0, headerEndIndex).join('\n');

    return { header, dialogues };
}

/**
 * Parses a single dialogue line
 */
function parseDialogueLine(line: string): AssDialogueLine | null {
    // Format: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
    const match = line.match(/^Dialogue:\s*(.+)$/);
    if (!match) return null;

    const parts = match[1].split(',');
    if (parts.length < 10) return null;

    return {
        layer: parts[0],
        start: parts[1],
        end: parts[2],
        style: parts[3],
        name: parts[4],
        marginL: parts[5],
        marginR: parts[6],
        marginV: parts[7],
        effect: parts[8],
        text: parts.slice(9).join(','), // Text may contain commas
    };
}

/**
 * Extracts plain text from all dialogues
 */
export function extractDialogText(assFile: AssFile): string {
    return assFile.dialogues
        .map(d => d.text.replace(/\{[^}]*\}/g, '').trim()) // Remove ASS formatting tags
        .filter(text => text.length > 0)
        .join('\n');
}

/**
 * Generates ASS file content from parsed structure
 * Preserves original format (with or without header)
 */
export function generateAssFile(assFile: AssFile): string {
    const dialogueLines = assFile.dialogues.map(d =>
        `Dialogue: ${d.layer},${d.start},${d.end},${d.style},${d.name},${d.marginL},${d.marginR},${d.marginV},${d.effect},${d.text}`
    );

    // If there's no header (simplified format), just return dialogue lines
    if (!assFile.header || assFile.header.trim() === '') {
        return dialogueLines.join('\n');
    }

    // Otherwise include the header
    return assFile.header + '\n' + dialogueLines.join('\n') + '\n';
}

/**
 * Extracts words from dialogue text, ignoring formatting tags
 */
function extractWords(text: string): string[] {
    // Remove all formatting tags and extract words
    const cleanText = text.replace(/\{[^}]*\}/g, '');
    return cleanText.trim().split(/\s+/).filter(w => w.length > 0);
}

/**
 * Updates dialogue text in ASS file while preserving formatting
 * Handles word-level replacement for word-by-word highlighting
 */
export function updateDialogueText(assFile: AssFile, newTexts: string[]): AssFile {
    // Extract all words from original dialogues
    const originalWords: string[] = [];
    assFile.dialogues.forEach(dialogue => {
        const words = extractWords(dialogue.text);
        originalWords.push(...words);
    });

    // Extract all words from new text
    const newWords: string[] = [];
    newTexts.forEach(line => {
        const words = line.trim().split(/\s+/).filter(w => w.length > 0);
        newWords.push(...words);
    });

    logger.info(`Replacing ${originalWords.length} words with ${newWords.length} new words`);

    // Create a mapping from old words to new words
    let wordIndex = 0;
    const updatedDialogues = assFile.dialogues.map((dialogue, dialogueIndex) => {
        const dialogueWords = extractWords(dialogue.text);

        if (dialogueWords.length === 0) {
            return dialogue;
        }

        // Replace words in this dialogue line
        let newText = dialogue.text;
        const replacements: Array<{ old: string, new: string }> = [];

        dialogueWords.forEach(oldWord => {
            if (wordIndex < newWords.length) {
                const newWord = newWords[wordIndex];

                // Track if word changed
                if (oldWord !== newWord) {
                    replacements.push({ old: oldWord, new: newWord });
                }

                // Replace the old word with new word, preserving formatting tags
                // Find the word outside of formatting tags
                const regex = new RegExp(`(?<!\\{[^}]*)\\b${escapeRegex(oldWord)}\\b(?![^{]*\\})`, 'g');
                newText = newText.replace(regex, newWord);
                wordIndex++;
            }
        });

        // Log changes for this dialogue line
        if (replacements.length > 0 && dialogue.text !== newText) {
            logger.info(`Line ${dialogueIndex + 1} changed:`);
            logger.info(`  Before: ${dialogue.text}`);
            logger.info(`  After:  ${newText}`);
            logger.info(`  Replacements: ${replacements.map(r => `"${r.old}" → "${r.new}"`).join(', ')}`);
        }

        return {
            ...dialogue,
            text: newText,
        };
    });

    return {
        ...assFile,
        dialogues: updatedDialogues,
    };
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Saves ASS file to disk
 */
export function saveAssFile(content: string, filePath: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
}
