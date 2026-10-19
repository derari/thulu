import { describe, expect, it } from 'vitest';
import { baseName, dirName, joinPath, normalizePath, relativePath } from './paths';

describe('paths', () => {
    it('normalizes backslashes', () => {
        expect(normalizePath('C:\\a\\b')).toBe('C:/a/b');
    });

    it('returns the base name for either separator', () => {
        expect(baseName('/a/b/c.http')).toBe('c.http');
        expect(baseName('C:\\a\\b')).toBe('b');
        expect(baseName('')).toBe('');
    });

    it('returns the parent directory with forward slashes', () => {
        expect(dirName('/a/b/c.http')).toBe('/a/b');
        expect(dirName('C:\\a\\b')).toBe('C:/a');
    });

    it('joins using the separator of the base path', () => {
        expect(joinPath('/a/b', 'c.http')).toBe('/a/b/c.http');
        expect(joinPath('C:\\a\\b', 'c.http')).toBe('C:\\a\\b\\c.http');
        expect(joinPath('/a/b/', 'c', 'd')).toBe('/a/b/c/d');
    });

    it('computes paths relative to a root', () => {
        expect(relativePath('/root/sub/a.http', '/root')).toBe('sub/a.http');
        expect(relativePath('C:\\root\\a.http', 'C:\\root')).toBe('a.http');
        expect(relativePath('/other/a.http', '/root')).toBe('/other/a.http');
    });
});
