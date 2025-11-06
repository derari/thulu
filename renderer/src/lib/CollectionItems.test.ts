import {describe, it, expect} from 'vitest';
import { formatVerb, getVerbColor, flattenCollection, flattenItems } from './CollectionItemsUtils';

const mockSection = {name: 'Test', startLineNumber: 1, endLineNumber: 2, verb: 'GET', url: 'url', isDivider: false};
const mockEnv = {folderPath: '/env', hasPublicEnv: true, hasPrivateEnv: false};
const mockItem = {
    title: 'File',
    filePath: '/file.http',
    folderPath: '/folder',
    items: [],
    sections: [mockSection],
    environments: mockEnv
};
const mockRoot = {
    title: 'Root',
    folderPath: '/root',
    items: [mockItem],
    environments: mockEnv
};

describe('CollectionItemsUtils', () => {
    it('formatVerb returns correct abbreviations', () => {
        expect(formatVerb('GET')).toBe('GET');
        expect(formatVerb('PATCH')).toBe('PTCH');
        expect(formatVerb('DELETE')).toBe('DEL');
        expect(formatVerb('OPTIONS')).toBe('OPT');
        expect(formatVerb('POST')).toBe('POST');
    });

    it('getVerbColor returns correct color', () => {
        expect(getVerbColor('GET')).toBe('var(--http-verb-get)');
        expect(getVerbColor('POST')).toBe('var(--http-verb-post)');
        expect(getVerbColor('PUT')).toBe('var(--http-verb-put)');
        expect(getVerbColor('PATCH')).toBe('var(--http-verb-patch)');
        expect(getVerbColor('DELETE')).toBe('var(--http-verb-delete)');
        expect(getVerbColor('FOO')).toBe('var(--http-verb-other)');
    });

    it('flattenCollection returns expected DisplayItem array', () => {
        const result = flattenCollection(mockRoot, (f) => false);
        expect(result.length).toBeGreaterThan(1);
        expect(result[0].isEnvironment).toBe(true);
        expect(result[1].isFolder).toBe(true);
        expect(result[1].item.title).toBe('File');
    });

    it('flattenItems returns expected DisplayItem array', () => {
        const result = flattenItems([mockItem], 1, (f) => false);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].isFolder).toBe(true);
        expect(result[0].item.title).toBe('File');
    });
});
