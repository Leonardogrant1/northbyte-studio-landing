import { describe, it, expect } from 'vitest';
import { normalizePublicUrl } from './r2';

describe('normalizePublicUrl', () => {
    it('prepends https:// when no scheme is present', () => {
        expect(normalizePublicUrl('n8n-media.northbyte.studio')).toBe('https://n8n-media.northbyte.studio');
    });

    it('preserves an existing https:// scheme', () => {
        expect(normalizePublicUrl('https://n8n-media.northbyte.studio')).toBe('https://n8n-media.northbyte.studio');
    });

    it('preserves an existing http:// scheme', () => {
        expect(normalizePublicUrl('http://localhost:9000')).toBe('http://localhost:9000');
    });

    it('strips a single trailing slash', () => {
        expect(normalizePublicUrl('https://n8n-media.northbyte.studio/')).toBe('https://n8n-media.northbyte.studio');
    });

    it('strips multiple trailing slashes', () => {
        expect(normalizePublicUrl('n8n-media.northbyte.studio///')).toBe('https://n8n-media.northbyte.studio');
    });

    it('returns an empty string unchanged', () => {
        expect(normalizePublicUrl('')).toBe('');
    });
});
