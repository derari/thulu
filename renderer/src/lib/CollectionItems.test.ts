import {describe, it, expect} from 'vitest';
import { formatVerb, getVerbColor, flattenCollection, flattenItems } from './CollectionItemsUtils';

const mockSection = {name: 'Test', startLineNumber: 1, endLineNumber: 2, verb: 'GET', url: 'url', isDivider: false, postScripts: []};
const mockEnv = {folderPath: '/env', hasPublicEnv: true, hasPrivateEnv: false};
const mockItem = {
    title: 'File',
    filePath: '/file.http',
    folderPath: '/folder',
    items: [],
    sections: [mockSection],
    environments: mockEnv,
    hasReadme: false
};
const mockRoot = {
    title: 'Root',
    folderPath: '/root',
    items: [mockItem],
    environments: mockEnv,
    hasReadme: true
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

    it('flattenCollection preserves hasReadme property from root item', () => {
        const result = flattenCollection(mockRoot, (f) => false);
        const rootEnvironmentItem = result[0];
        expect(rootEnvironmentItem.item.title).toBe('Environments');
        const fileItem = result.find(item => item.item.title === 'File');
        expect(fileItem).toBeDefined();
        expect(fileItem?.item.hasReadme).toBe(false);
    });

    it('flattenItems preserves hasReadme property when flattening items', () => {
        const itemWithReadme = {
            title: 'FolderWithReadme',
            folderPath: '/folder-with-readme',
            items: [],
            hasReadme: true
        };
        const itemWithoutReadme = {
            title: 'FolderWithoutReadme',
            folderPath: '/folder-without-readme',
            items: [],
            hasReadme: false
        };

        const result = flattenItems([itemWithReadme, itemWithoutReadme], 0, (f) => false);

        const itemWithReadmeFlat = result.find(item => item.item.title === 'FolderWithReadme');
        const itemWithoutReadmeFlat = result.find(item => item.item.title === 'FolderWithoutReadme');

        expect(itemWithReadmeFlat?.item.hasReadme).toBe(true);
        expect(itemWithoutReadmeFlat?.item.hasReadme).toBe(false);
    });

    it('hasReadme is set for file items created during flattening', () => {
        const result = flattenItems([mockItem], 0, (f) => false);
        const fileDisplayItem = result[0];
        expect(fileDisplayItem.isFile).toBe(true);
        expect(fileDisplayItem.item.hasReadme).toBe(false);
    });

    it('hasReadme is set to true when folder contains markdown files', () => {
        const folderWithMarkdown = {
            title: 'DocFolder',
            folderPath: '/docs',
            items: [],
            hasReadme: true
        };

        const result = flattenItems([folderWithMarkdown], 0, (f) => false);
        expect(result[0].item.hasReadme).toBe(true);
    });

    it('hasReadme is false for folders without markdown files', () => {
        const folderWithoutMarkdown = {
            title: 'ConfigFolder',
            folderPath: '/config',
            items: [],
            hasReadme: false
        };

        const result = flattenItems([folderWithoutMarkdown], 0, (f) => false);
        expect(result[0].item.hasReadme).toBe(false);
    });

    it('hasReadme property is included in display items for all item types', () => {
        const itemsToTest = [
            { title: 'WithReadme', folderPath: '/with', items: [], hasReadme: true },
            { title: 'WithoutReadme', folderPath: '/without', items: [], hasReadme: false },
            { title: 'File', filePath: '/file.http', hasReadme: false }
        ];

        const result = flattenItems(itemsToTest, 0, (f) => false);

        result.forEach(displayItem => {
            expect(displayItem.item).toHaveProperty('hasReadme');
            expect(typeof displayItem.item.hasReadme).toBe('boolean');
        });
    });
});
