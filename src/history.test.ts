import {describe, expect, it} from 'vitest';
import {parseContentDispositionFilename, sanitizeBodyFileName} from './history.js';

describe('parseContentDispositionFilename', () => {
    it('returns null when header is absent', () => {
        expect(parseContentDispositionFilename({})).toBeNull();
    });

    it('returns null for inline disposition with no filename', () => {
        expect(parseContentDispositionFilename({'content-disposition': 'inline'})).toBeNull();
    });

    it('parses plain filename', () => {
        expect(parseContentDispositionFilename({'content-disposition': 'attachment; filename="report.pdf"'})).toBe('report.pdf');
    });

    it('parses plain filename without quotes', () => {
        expect(parseContentDispositionFilename({'content-disposition': 'attachment;filename=94.wav'})).toBe('94.wav');
    });

    it('parses RFC 5987 filename* (UTF-8 encoded)', () => {
        expect(parseContentDispositionFilename({
            'content-disposition': "attachment; filename*=UTF-8''report%20final.pdf"
        })).toBe('report final.pdf');
    });

    it('prefers filename* over filename when both are present', () => {
        expect(parseContentDispositionFilename({
            'content-disposition': "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''preferred.pdf"
        })).toBe('preferred.pdf');
    });

    it('falls back to plain filename when RFC 5987 decode fails', () => {
        expect(parseContentDispositionFilename({
            'content-disposition': "attachment; filename*=UTF-8''%invalid; filename=\"fallback.pdf\""
        })).toBe('fallback.pdf');
    });

    it('handles Content-Disposition header with capital C', () => {
        expect(parseContentDispositionFilename({'Content-Disposition': 'attachment; filename="data.json"'})).toBe('data.json');
    });

    it('handles non-ASCII characters encoded in RFC 5987', () => {
        expect(parseContentDispositionFilename({
            'content-disposition': "attachment; filename*=UTF-8''caf%C3%A9.txt"
        })).toBe('café.txt');
    });
});

describe('sanitizeBodyFileName', () => {
    it('returns a clean filename unchanged', () => {
        expect(sanitizeBodyFileName('report.pdf', 'fallback.bin')).toBe('report.pdf');
    });

    it('strips forward slashes (path traversal)', () => {
        expect(sanitizeBodyFileName('../etc/passwd', 'fallback.bin')).toBe('etcpasswd');
    });

    it('strips backslashes (Windows path traversal)', () => {
        expect(sanitizeBodyFileName('..\\windows\\system32\\file', 'fallback.bin')).toBe('windowssystem32file');
    });

    it('strips leading dots after slash removal', () => {
        expect(sanitizeBodyFileName('...hidden', 'fallback.bin')).toBe('hidden');
    });

    it('returns fallback for empty string', () => {
        expect(sanitizeBodyFileName('', 'fallback.bin')).toBe('fallback.bin');
    });

    it('returns fallback for whitespace-only string', () => {
        expect(sanitizeBodyFileName('   ', 'fallback.bin')).toBe('fallback.bin');
    });

    it('returns fallback for meta.json (case-insensitive)', () => {
        expect(sanitizeBodyFileName('meta.json', 'fallback.bin')).toBe('fallback.bin');
        expect(sanitizeBodyFileName('META.JSON', 'fallback.bin')).toBe('fallback.bin');
    });

    it('returns fallback for names starting with request-body', () => {
        expect(sanitizeBodyFileName('request-body.json', 'fallback.bin')).toBe('fallback.bin');
        expect(sanitizeBodyFileName('request-body-extra.txt', 'fallback.bin')).toBe('fallback.bin');
    });

    it('allows filenames that merely contain "request-body" not at start', () => {
        expect(sanitizeBodyFileName('my-request-body.json', 'fallback.bin')).toBe('my-request-body.json');
    });

    it('strips null bytes', () => {
        expect(sanitizeBodyFileName('file\x00name.txt', 'fallback.bin')).toBe('filename.txt');
    });
});
