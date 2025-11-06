// preload.ts

// From Electron 20 onwards, preload scripts are sandboxed by default 
// and no longer have access to a full Node.js environment. Practically, 
// this means that you have a polyfilled require function that only 
// has access to a limited set of APIs.
// Read more: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload

import {contextBridge, ipcRenderer} from 'electron';

// Global callback storage - support multiple subscribers
const preferencesOpenCallbacks: Array<() => void> = [];
const preferencesLoadCallbacks: Array<(preferences: { appearance: string }) => void> = [];

// Set up single listeners that call all registered callbacks
ipcRenderer.on('preferences:open', () => {
    preferencesOpenCallbacks.forEach(callback => callback());
});

ipcRenderer.on('preferences:load', (event, preferences: { appearance: string }) => {
    preferencesLoadCallbacks.forEach(callback => callback(preferences));
});

// expose some IPC channels to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    listDirectory: async (dirPath: string) => {
        return await ipcRenderer.invoke('fs:listDirectory', dirPath);
    },
    readFile: async (filePath: string) => {
        return await ipcRenderer.invoke('fs:readFile', filePath);
    },
    writeFile: async (filePath: string, content: string) => {
        return await ipcRenderer.invoke('fs:writeFile', filePath, content);
    },
    fileExists: async (filePath: string) => {
        return await ipcRenderer.invoke('fs:fileExists', filePath);
    },
    deletePath: async (filePath: string) => {
        return await ipcRenderer.invoke('fs:deletePath', filePath);
    },
    renamePath: async (oldPath: string, newPath: string) => {
        return await ipcRenderer.invoke('fs:renamePath', oldPath, newPath);
    },
    createFolder: async (folderPath: string) => {
        return await ipcRenderer.invoke('fs:createFolder', folderPath);
    },
    createFile: async (filePath: string, content: string) => {
        return await ipcRenderer.invoke('fs:createFile', filePath, content);
    },
    updateCollectionName: async (collectionPath: string, newName: string) => {
        return await ipcRenderer.invoke('collection:updateName', collectionPath, newName);
    },
    showInFileSystem: async (path: string) => {
        return await ipcRenderer.invoke('system:showInFileSystem', path);
    },
    httpRequest: async (options: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
    }) => {
        return await ipcRenderer.invoke('http:request', options);
    },
    executeScript: async (params: {
        code: string;
        timeout: number;
        collectionPath?: string;
        responseBody?: string;
        responseContentType?: string;
    }) => {
        return await ipcRenderer.invoke('script:execute', params);
    },
    onPreferencesOpen: (callback: () => void) => {
        preferencesOpenCallbacks.push(callback);
        return () => {
            const index = preferencesOpenCallbacks.indexOf(callback);
            if (index > -1) {
                preferencesOpenCallbacks.splice(index, 1);
            }
        };
    },
    onPreferencesLoad: (callback: (preferences: { appearance: string }) => void) => {
        preferencesLoadCallbacks.push(callback);
        return () => {
            const index = preferencesLoadCallbacks.indexOf(callback);
            if (index > -1) {
                preferencesLoadCallbacks.splice(index, 1);
            }
        };
    },
    requestPreferences: () => {
        ipcRenderer.send('preferences:request');
    },
    savePreferences: (preferences: { appearance: string }) => {
        ipcRenderer.send('preferences:save', preferences);
    }
});

// we can also expose variables, not just functions
contextBridge.exposeInMainWorld('versions', {
    chrome: () => process.versions.chrome,
})
