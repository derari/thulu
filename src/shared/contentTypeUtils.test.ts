import { describe, expect, it } from 'vitest';
import { getExtensionForContentType, getTextFormat, isBinaryContentType } from './contentTypeUtils';

describe('contentTypeUtils', () => {
    it('maps content types to file extensions', () => {
        expect(getExtensionForContentType('application/json; charset=utf-8')).toBe('.json');
        expect(getExtensionForContentType('image/png')).toBe('.png');
        expect(getExtensionForContentType('text/whatever')).toBe('.txt');
        expect(getExtensionForContentType(null)).toBe('.bin');
    });

    it('flags binary content types', () => {
        expect(isBinaryContentType('application/pdf')).toBe(true);
        expect(isBinaryContentType('image/svg+xml')).toBe(false);
        expect(isBinaryContentType('application/json')).toBe(false);
        expect(isBinaryContentType(null)).toBe(false);
    });

    it('detects the text format to format and highlight', () => {
        expect(getTextFormat('application/json')).toBe('json');
        expect(getTextFormat('application/vnd.api+json; charset=utf-8')).toBe('json');
        expect(getTextFormat('application/xhtml+xml')).toBe('html');
        expect(getTextFormat('image/svg+xml')).toBe('xml');
        expect(getTextFormat('text/plain')).toBeNull();
        expect(getTextFormat(null)).toBeNull();
    });
});
