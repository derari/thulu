// preload.ts

// From Electron 20 onwards, preload scripts are sandboxed by default 
// and no longer have access to a full Node.js environment. Practically, 
// this means that you have a polyfilled require function that only 
// has access to a limited set of APIs.
// Read more: https://www.electronjs.org/docs/latest/tutorial/tutorial-preload

import { contextBridge, ipcRenderer } from 'electron';

// expose some IPC channels to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    requestProcessVersions: async () => {
        return await ipcRenderer.invoke('renderer:requestProcessVersions');
    },
    loadCollectionItems: async (collectionPath: string) => {
        return await ipcRenderer.invoke('collection:loadItems', collectionPath);
    },
    readHttpFile: async (filePath: string) => {
        return await ipcRenderer.invoke('http:readFile', filePath);
    },
    writeHttpFile: async (filePath: string, content: string) => {
        return await ipcRenderer.invoke('http:writeFile', filePath, content);
    },
    httpRequest: async (options: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
    }) => {
        return await ipcRenderer.invoke('http:request', options);
    },
    onPreferencesOpen: (callback: () => void) => {
        ipcRenderer.on('preferences:open', () => {
            callback();
        });
    },
    onPreferencesLoad: (callback: (preferences: { appearance: string }) => void) => {
        ipcRenderer.on('preferences:load', (event, preferences) => {
            callback(preferences);
        });
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
