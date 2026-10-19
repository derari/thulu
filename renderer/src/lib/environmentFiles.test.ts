import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    deleteEnvironment,
    folderAndAncestors,
    folderLabel,
    getVariableParentSources,
    renameEnvironment,
    saveEnvironmentVariables
} from './environmentFiles';

const files = new Map<string, string>();
const writeFile = vi.fn(async (path: string, content: string) => {
    files.set(path, content);
    return { success: true };
});

beforeEach(() => {
    files.clear();
    writeFile.mockClear();
    global.window = {
        electronAPI: {
            readFile: vi.fn(async (path: string) => files.get(path) ?? null),
            writeFile
        }
    } as any;
});

function written(path: string) {
    return JSON.parse(files.get(path)!);
}

describe('folderAndAncestors', () => {
    it('walks from the folder up to the root', () => {
        expect(folderAndAncestors('/c/a/b', '/c')).toEqual(['/c/a/b', '/c/a', '/c']);
    });

    it('normalizes Windows paths', () => {
        expect(folderAndAncestors('C:\\c\\a', 'C:\\c')).toEqual(['C:/c/a', 'C:/c']);
    });

    it('returns only the root for the root itself', () => {
        expect(folderAndAncestors('/c', '/c')).toEqual(['/c']);
    });

    it('does not walk above the root', () => {
        expect(folderAndAncestors('/other/x', '/c')).toEqual(['/other/x']);
    });
});

describe('folderLabel', () => {
    it('labels the root and other folders', () => {
        expect(folderLabel('C:\\c', 'C:/c')).toBe('root');
        expect(folderLabel('/c/a', '/c')).toBe('a');
    });
});

describe('environment operations', () => {
    it('saves editable variables into the public or private file and removes deleted ones', async () => {
        files.set('/c/http-client.env.json', JSON.stringify({ dev: { old: '1', gone: '2', moved: '3' } }));

        await saveEnvironmentVariables(
            '/c',
            'dev',
            [
                { name: 'fresh', value: 'x', isPrivate: false, isEditable: true, isInherited: false },
                { name: 'moved', value: '3', isPrivate: true, isEditable: true, isInherited: false },
                { name: 'gone', value: '2', isPrivate: false, isEditable: true, isInherited: false }
            ],
            new Set(['gone'])
        );

        expect(written('/c/http-client.env.json').dev).toEqual({ old: '1', fresh: 'x' });
        expect(written('/c/http-client.private.env.json').dev).toEqual({ moved: '3' });
    });

    it('renames an environment in both files', async () => {
        files.set('/c/http-client.env.json', JSON.stringify({ dev: { a: '1' } }));
        files.set('/c/http-client.private.env.json', JSON.stringify({ dev: { b: '2' } }));

        await renameEnvironment('/c', 'dev', 'staging');

        expect(written('/c/http-client.env.json')).toEqual({ staging: { a: '1' } });
        expect(written('/c/http-client.private.env.json')).toEqual({ staging: { b: '2' } });
    });

    it('deletes an environment from both files', async () => {
        files.set('/c/http-client.env.json', JSON.stringify({ dev: { a: '1' }, prod: {} }));
        files.set('/c/http-client.private.env.json', JSON.stringify({ dev: { b: '2' } }));

        await deleteEnvironment('/c', 'dev');

        expect(written('/c/http-client.env.json')).toEqual({ prod: {} });
        expect(written('/c/http-client.private.env.json')).toEqual({});
    });

    it('throws when a write fails', async () => {
        writeFile.mockResolvedValueOnce({ success: false, error: 'disk full' } as any);
        await expect(deleteEnvironment('/c', 'dev')).rejects.toThrow('disk full');
    });

    it('lists parent values nearest ancestor first, public before private', async () => {
        files.set('/c/a/http-client.env.json', JSON.stringify({ dev: { host: 'a-public' } }));
        files.set('/c/a/http-client.private.env.json', JSON.stringify({ dev: { host: 'a-private' } }));
        files.set('/c/http-client.env.json', JSON.stringify({ dev: { host: 'root' } }));

        const sources = await getVariableParentSources('dev', 'host', '/c/a/b', '/c');

        expect(sources).toEqual([
            { source: 'a', value: 'a-public', isPrivate: false },
            { source: 'a', value: 'a-private', isPrivate: true },
            { source: 'c', value: 'root', isPrivate: false }
        ]);
    });
});
