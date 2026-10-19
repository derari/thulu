// Globally declared types used by both Electron and SvelteKit

import type {
    DirectoryEntry,
    FileOperationResult,
    HistoryMeta,
    HttpRequestOptions,
    HttpResponse,
    SaveHistoryParams,
    SaveHistoryResult,
    ScriptExecutionParams,
    ScriptExecutionResult
} from './src/shared/ipc';

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
        collapsedPaths?: string[];
    }

    // The Window interface is where the preload script exposes its API to the renderer process.
    // Compare this to the contextBridge.exposeInMainWorld() call in src/preload.ts.
    interface Window {
        electronAPI: {
            listDirectory: (dirPath: string) => Promise<DirectoryEntry[]>;
            readFile: (filePath: string) => Promise<string | null>;
            readFileBinary: (filePath: string) => Promise<string | null>;
            writeFile: (filePath: string, content: string) => Promise<FileOperationResult>;
            fileExists: (filePath: string) => Promise<boolean>;
            deletePath: (filePath: string) => Promise<FileOperationResult>;
            renamePath: (oldPath: string, newPath: string) => Promise<FileOperationResult>;
            createFolder: (folderPath: string) => Promise<FileOperationResult>;
            createFile: (filePath: string, content: string) => Promise<FileOperationResult>;
            updateCollectionName: (collectionPath: string, newName: string) => Promise<FileOperationResult>;
            showInFileSystem: (path: string) => Promise<{ success: boolean }>;
            openFile: (filePath: string) => Promise<{ success: boolean }>;
            openExternal: (url: string) => Promise<{ success: boolean }>;
            httpRequest: (options: HttpRequestOptions) => Promise<HttpResponse>;
            executeScript: (params: ScriptExecutionParams) => Promise<ScriptExecutionResult>;
            onPreferencesOpen: (callback: () => void) => void;
            onPreferencesLoad: (callback: (preferences: Preferences) => void) => () => void;
            requestPreferences: () => void;
            savePreferences: (preferences: Partial<Preferences>) => void;
            saveHistory: (params: SaveHistoryParams) => Promise<SaveHistoryResult>;
            listHistory: (collectionPath: string) => Promise<HistoryMeta[]>;
        };
    }

    // This is where declarations for types you want to use in the main process and the renderer process go.
    type ProcessVersions = NodeJS.ProcessVersions;
}

export {};
