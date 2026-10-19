import {ipcMain, shell} from 'electron';
import {updateCollectionName} from './collections.js';
import {
    createFile,
    createFolder,
    deletePath,
    fileExists,
    listDirectory,
    readFile,
    readFileBinary,
    renamePath,
    writeFile
} from './fileSystem.js';
import {listHistoryEntries, saveHistoryEntry} from './history.js';
import {makeHttpRequest} from './httpClient.js';
import {savePreferences} from './preferences.js';
import {executeScript} from './scriptExecutor.js';
import type {HttpRequestOptions, SaveHistoryParams, ScriptExecutionParams} from './shared/ipc.js';
import {sendPreferencesToRenderer} from './window.js';

/** Registers the handlers for every channel exposed to the renderer in preload.ts. */
export function registerIpcHandlers() {
    ipcMain.handle('fs:listDirectory', function handleListDirectory(event, dirPath: string) {
        return listDirectory(dirPath);
    });
    ipcMain.handle('fs:readFile', function handleReadFile(event, filePath: string) {
        return readFile(filePath);
    });
    ipcMain.handle('fs:readFileBinary', function handleReadFileBinary(event, filePath: string) {
        return readFileBinary(filePath);
    });
    ipcMain.handle('fs:writeFile', function handleWriteFile(event, filePath: string, content: string) {
        return writeFile(filePath, content);
    });
    ipcMain.handle('fs:fileExists', function handleFileExists(event, filePath: string) {
        return fileExists(filePath);
    });
    ipcMain.handle('fs:deletePath', function handleDeletePath(event, filePath: string) {
        return deletePath(filePath);
    });
    ipcMain.handle('fs:renamePath', function handleRenamePath(event, oldPath: string, newPath: string) {
        return renamePath(oldPath, newPath);
    });
    ipcMain.handle('fs:createFolder', function handleCreateFolder(event, folderPath: string) {
        return createFolder(folderPath);
    });
    ipcMain.handle('fs:createFile', function handleCreateFile(event, filePath: string, content: string) {
        return createFile(filePath, content);
    });
    ipcMain.handle('collection:updateName', function handleUpdateCollectionName(event, collectionPath: string, newName: string) {
        const result = updateCollectionName(collectionPath, newName);
        if (result.success) {
            sendPreferencesToRenderer();
        }
        return result;
    });
    ipcMain.handle('system:showInFileSystem', async function handleShowInFileSystem(event, path: string) {
        await shell.openPath(path);
        return { success: true };
    });
    ipcMain.handle('system:openFile', async function handleOpenFile(event, filePath: string) {
        await shell.openPath(filePath);
        return { success: true };
    });
    ipcMain.handle('system:openExternal', async function handleOpenExternal(event, url: string) {
        await shell.openExternal(url);
        return { success: true };
    });
    ipcMain.on('preferences:save', function handlePreferencesSave(event, preferences: Preferences) {
        savePreferences(preferences);
        sendPreferencesToRenderer();
    });
    ipcMain.on('preferences:request', function handlePreferencesRequest() {
        sendPreferencesToRenderer();
    });
    ipcMain.handle('http:request', function handleHttpRequest(event, options: HttpRequestOptions) {
        return makeHttpRequest(options);
    });
    ipcMain.handle('script:execute', function handleScriptExecute(event, params: ScriptExecutionParams) {
        return executeScript(params);
    });
    ipcMain.handle('history:save', function handleHistorySave(event, params: SaveHistoryParams) {
        return saveHistoryEntry(params);
    });
    ipcMain.handle('history:list', function handleHistoryList(event, collectionPath: string) {
        return listHistoryEntries(collectionPath);
    });
}
