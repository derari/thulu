import {describe, expect, it, vi, beforeEach} from 'vitest';
import * as fs from 'fs';
import {readFile, writeFile, listDirectory, fileExists} from './fileOperations.js';

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

