import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as fs from 'fs';
import {
    fileExists,
    listDirectory,
    parseContentDispositionFilename,
    readFile,
    sanitizeBodyFileName,
    writeFile
} from './fileOperations.js';

vi.mock('fs');
vi.mock('electron', () => ({
    app: {
        getPath: vi.fn()
    }
}));

describe('readFile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return file content when file exists', () => {
        const mockContent = 'test content';
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'readFileSync').mockReturnValue(mockContent);

        const result = readFile('/test/path.txt');

        expect(result).toBe(mockContent);
        expect(fs.existsSync).toHaveBeenCalledWith('/test/path.txt');
        expect(fs.readFileSync).toHaveBeenCalledWith('/test/path.txt', 'utf-8');
    });

    it('should return null when file does not exist', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const result = readFile('/test/nonexistent.txt');

        expect(result).toBeNull();
        expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent.txt');
    });
});

describe('writeFile', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully write file content', () => {
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

        const result = writeFile('/test/path.txt', 'content');

        expect(result).toEqual({success: true});
        expect(fs.writeFileSync).toHaveBeenCalledWith('/test/path.txt', 'content', 'utf-8');
    });

    it('should return error when write fails', () => {
        const mockError = new Error('Write failed');
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
            throw mockError;
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = writeFile('/test/path.txt', 'content');

        expect(result).toEqual({success: false, error: 'Error: Write failed'});
        expect(console.error).toHaveBeenCalled();
    });
});

describe('listDirectory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return empty array when directory does not exist', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const result = listDirectory('/test/nonexistent');

        expect(result).toEqual([]);
        expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent');
    });

    it('should list directory contents when directory exists', () => {
        const mockEntries = [
            {name: 'file.txt', isDirectory: () => false, isFile: () => true},
            {name: 'folder', isDirectory: () => true, isFile: () => false}
        ] as fs.Dirent[];
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'readdirSync').mockReturnValue(mockEntries as any);

        const result = listDirectory('/test/dir');

        expect(result).toEqual([
            {name: 'file.txt', isDirectory: false, isFile: true},
            {name: 'folder', isDirectory: true, isFile: false}
        ]);
    });

    it('should handle empty directory', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'readdirSync').mockReturnValue([]);

        const result = listDirectory('/test/empty');

        expect(result).toEqual([]);
    });
});

describe('fileExists', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return true when file exists', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const result = fileExists('/test/exists.txt');

        expect(result).toBe(true);
        expect(fs.existsSync).toHaveBeenCalledWith('/test/exists.txt');
    });

    it('should return false when file does not exist', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const result = fileExists('/test/nonexistent.txt');

        expect(result).toBe(false);
        expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent.txt');
    });
});

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
