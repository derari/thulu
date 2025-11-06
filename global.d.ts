// Globally declared types used by both Electron and SvelteKit

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface Platform {}

    }

    interface Preferences {
        appearance?: 'light' | 'dark' | 'system';

        windowWidth?: number;
        windowHeight?: number;
        sidebarWidth?: number;
        responseWidth?: number;
        responseHeight?: number;

        currentCollectionPath?: string;
        collections?: CollectionMetaData[];
    }

    interface CollectionMetaData {
        path: string;
        name: string;
    }

    // The Window interface is where the preload script exposes its API to the renderer process.
    // Compare this to the contextBridge.exposeInMainWorld() call in src/preload.ts.
    interface Window {
        electronAPI: {
            listDirectory: (dirPath: string) => Promise<Array<{ name: string, isDirectory: boolean, isFile: boolean }>>;
            readFile: (filePath: string) => Promise<string | null>;
            writeFile: (filePath: string, content: string) => Promise<{ success: boolean, error?: string }>;
            fileExists: (filePath: string) => Promise<boolean>;
            deletePath: (filePath: string) => Promise<{ success: boolean, error?: string }>;
            renamePath: (oldPath: string, newPath: string) => Promise<{ success: boolean, error?: string }>;
            createFolder: (folderPath: string) => Promise<{ success: boolean, error?: string }>;
            createFile: (filePath: string, content: string) => Promise<{ success: boolean, error?: string }>;
            updateCollectionName: (collectionPath: string, newName: string) => Promise<{ success: boolean, error?: string }>;
            showInFileSystem: (path: string) => Promise<{ success: boolean }>;
            httpRequest: (options: {
                url: string,
                method: string,
                headers: Record<string, string>,
                body?: string
            }) => Promise<{
                ok: boolean,
                status: number,
                statusText: string,
                headers: Record<string, string>,
                body: string
            }>;
            executeScript: (params: {
                code: string,
                timeout: number,
                collectionPath?: string,
                responseBody?: string,
                responseContentType?: string
            }) => Promise<{
                success: boolean,
                error?: string,
                logs: string[],
                globalVariableChanges?: Record<string, string>
            }>;
            onPreferencesOpen: (callback: () => void) => void;
            onPreferencesLoad: (callback: (preferences: Preferences) => void) => void;
            requestPreferences: () => void;
            savePreferences: (preferences: Preferences) => void;
        };
    }

    // This is where declarations for types you want to use in the main process and the renderer process go.
    type ProcessVersions = NodeJS.ProcessVersions;
}

export {};
