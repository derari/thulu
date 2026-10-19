import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CollectionItem } from './collection';
import {
    createItem,
    deleteEnvironment,
    deleteItem,
    itemName,
    NEW_REQUEST_TEMPLATE,
    renameCollection,
    renameItem
} from './collectionOperations';
import { currentCollection } from './stores/currentCollection';
import { openFile } from './stores/openFile';

vi.mock('./stores/currentCollection', async () => {
    const { writable } = await import('svelte/store');
    return {
        currentCollection: Object.assign(writable({ path: '/c', name: 'C' }), {
            reload: vi.fn(),
            loadCollection: vi.fn()
        })
    };
});

vi.mock('./stores/openFile', async () => {
    const { writable } = await import('svelte/store');
    return { openFile: Object.assign(writable<{ filePath: string } | null>(null), { close: vi.fn() }) };
});

const ok = { success: true };
const failed = { success: false, error: 'nope' };
let api: Record<string, ReturnType<typeof vi.fn>>;

function setOpenFile(filePath: string | null) {
    (openFile as any).set(filePath ? { filePath } : null);
}

beforeEach(() => {
    vi.clearAllMocks();
    setOpenFile(null);
    api = {
        createFolder: vi.fn().mockResolvedValue(ok),
        createFile: vi.fn().mockResolvedValue(ok),
        renamePath: vi.fn().mockResolvedValue(ok),
        deletePath: vi.fn().mockResolvedValue(ok),
        updateCollectionName: vi.fn().mockResolvedValue(ok)
    };
    (global as any).window = { electronAPI: api };
});

const folderOnly: CollectionItem = { title: 'users', folderPath: '/c/users', hasReadme: false };
const fileOnly: CollectionItem = { title: 'login', filePath: '/c/login.http', hasReadme: false };
const fileAndFolder: CollectionItem = {
    title: 'orders',
    filePath: '/c/orders.http',
    folderPath: '/c/orders',
    hasReadme: false
};

describe('itemName', () => {
    it('uses the file name without extension, or the folder name', () => {
        expect(itemName(fileOnly)).toBe('login');
        expect(itemName(fileAndFolder)).toBe('orders');
        expect(itemName(folderOnly)).toBe('users');
        expect(itemName({ title: 'x', hasReadme: false })).toBe('');
    });
});

describe('createItem', () => {
    it('creates a folder inside the folder of the item', async () => {
        await expect(createItem('folder', folderOnly, 'admin')).resolves.toBe(true);

        expect(api.createFolder).toHaveBeenCalledWith('/c/users/admin');
        expect(currentCollection.reload).toHaveBeenCalled();
    });

    it('creates a folder next to a file without folder', async () => {
        await createItem('folder', fileOnly, 'sub');

        expect(api.createFolder).toHaveBeenCalledWith('/c/sub');
    });

    it('creates a request file in the folder', async () => {
        await createItem('file', folderOnly, 'list');

        expect(api.createFolder).not.toHaveBeenCalled();
        expect(api.createFile).toHaveBeenCalledWith('/c/users/list.http', NEW_REQUEST_TEMPLATE);
    });

    it('gives a file without folder a folder named after it first', async () => {
        await createItem('file', fileOnly, 'refresh');

        expect(api.createFolder).toHaveBeenCalledWith('/c/login');
        expect(api.createFile).toHaveBeenCalledWith('/c/login/refresh.http', NEW_REQUEST_TEMPLATE);
    });

    it('adds a request to a new file inside the folder', async () => {
        await createItem('request', folderOnly, 'list', true);

        expect(api.createFile).toHaveBeenCalledWith('/c/users/list.http', NEW_REQUEST_TEMPLATE);
    });

    it('adds a request to a file named after the folder, next to it', async () => {
        await createItem('request', folderOnly, 'ignored', false);

        expect(api.createFolder).not.toHaveBeenCalled();
        expect(api.createFile).toHaveBeenCalledWith('/c/users.http', NEW_REQUEST_TEMPLATE);
    });

    it('does not reload when creating fails', async () => {
        api.createFolder.mockResolvedValue(failed);

        await expect(createItem('folder', folderOnly, 'admin')).resolves.toBe(false);

        expect(currentCollection.reload).not.toHaveBeenCalled();
    });
});

describe('renameItem', () => {
    it('renames the file keeping its extension, and the folder', async () => {
        await renameItem(fileAndFolder, 'purchases', true, true);

        expect(api.renamePath).toHaveBeenCalledWith('/c/orders.http', '/c/purchases.http');
        expect(api.renamePath).toHaveBeenCalledWith('/c/orders', '/c/purchases');
        expect(currentCollection.reload).toHaveBeenCalled();
    });

    it('renames only what was selected', async () => {
        await renameItem(fileAndFolder, 'purchases', false, true);

        expect(api.renamePath).toHaveBeenCalledTimes(1);
    });

    it('closes the file when it is open', async () => {
        setOpenFile('/c/orders.http');

        await renameItem(fileAndFolder, 'purchases', true, true);

        expect(openFile.close).toHaveBeenCalled();
    });

    it('keeps everything as is when a rename fails', async () => {
        api.renamePath.mockResolvedValue(failed);
        setOpenFile('/c/orders.http');

        await expect(renameItem(fileAndFolder, 'purchases', true, true)).resolves.toBe(false);

        expect(openFile.close).not.toHaveBeenCalled();
        expect(currentCollection.reload).not.toHaveBeenCalled();
    });
});

describe('deleteItem', () => {
    it('deletes the path, closes it if open and reloads', async () => {
        setOpenFile('/c/login.http');

        await expect(deleteItem('/c/login.http')).resolves.toBe(true);

        expect(api.deletePath).toHaveBeenCalledWith('/c/login.http');
        expect(openFile.close).toHaveBeenCalled();
        expect(currentCollection.reload).toHaveBeenCalled();
    });

    it('leaves another open file alone', async () => {
        setOpenFile('/c/other.http');

        await deleteItem('/c/login.http');

        expect(openFile.close).not.toHaveBeenCalled();
    });
});

describe('deleteEnvironment', () => {
    it('deletes the env files and reloads', async () => {
        await expect(
            deleteEnvironment({ folderPath: '/c/users', hasPublicEnv: true, hasPrivateEnv: true })
        ).resolves.toBe(true);

        expect(api.deletePath).toHaveBeenCalledWith('/c/users/http-client.env.json');
        expect(api.deletePath).toHaveBeenCalledWith('/c/users/http-client.private.env.json');
        expect(currentCollection.reload).toHaveBeenCalled();
    });
});

describe('renameCollection', () => {
    it('renames and loads the collection under the new name', async () => {
        await expect(renameCollection('New')).resolves.toBe(true);

        expect(api.updateCollectionName).toHaveBeenCalledWith('/c', 'New');
        expect((currentCollection as any).loadCollection).toHaveBeenCalledWith('/c', 'New');
    });
});
