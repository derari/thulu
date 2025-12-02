import {app, BrowserWindow, dialog, ipcMain, shell, Menu} from 'electron';
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import serve from 'electron-serve';
import {loadPreferences, savePreferences, readFile, readFileBinary, writeFile, listDirectory, fileExists, deletePath, renamePath, createFolder, createFile, updateCollectionName} from './fileOperations.js';
import {executeScript, type ScriptExecutionParams} from './scriptExecutor.js';

const serveURL = serve({directory: '.'});
const isDev: boolean = !app.isPackaged;
const port: string = process.env.PORT ? process.env.PORT.toString() : '5173';
let mainWindow: BrowserWindow | null;

function sendPreferencesToRenderer() {
    if (mainWindow) {
        mainWindow.webContents.send('preferences:load', loadPreferences());
    }
}

function createMainWindow() {
    const preloadPath = path.join(__dirname, "preload.js");
    const prefs = loadPreferences();
    return new BrowserWindow({
        height: prefs.windowHeight,
        width: prefs.windowWidth,
        webPreferences: {
            preload: preloadPath,
            devTools: true,
            nodeIntegration: true,
            contextIsolation: true,
            sandbox: true
        }
    });
}

function loadVite(port: string) {
    mainWindow.loadURL(`http://localhost:${port}`).catch((e) => {
        console.log('Error loading URL, retrying', e);
        setTimeout(function retryLoadVite() {
            loadVite(port);
        }, 200);
    });
}

function launchMainWindow() {
    mainWindow = createMainWindow();
    mainWindow.once('close', function handleClose() {
        if (mainWindow) {
            const [width, height] = mainWindow.getSize();
            savePreferences({windowWidth: width, windowHeight: height});
        }
        mainWindow = null;
    });
    if (isDev) {
        loadVite(port);
        mainWindow.webContents.openDevTools();
        return;
    }
    serveURL(mainWindow);
}

async function openCollection() {
    if (!mainWindow) return;

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) return;

    const folderPath = result.filePaths[0];
    const thuluJsonPath = path.join(folderPath, '.thulu.json');
    const folderName = path.basename(folderPath);

    let collectionName = folderName;

    if (fs.existsSync(thuluJsonPath)) {
        const data = fs.readFileSync(thuluJsonPath, 'utf-8');
        const config = JSON.parse(data);
        if (config.collectionName) {
            collectionName = config.collectionName;
        }
    }

    if (!fs.existsSync(thuluJsonPath)) {
        const config = {collectionName: folderName};
        fs.writeFileSync(thuluJsonPath, JSON.stringify(config, null, 2));
    }

    const prefs = loadPreferences();
    const collections = prefs.collections || [];

    const existingIndex = collections.findIndex(c => c.path === folderPath);
    if (existingIndex >= 0) {
        collections[existingIndex] = {path: folderPath, name: collectionName};
    }
    if (existingIndex < 0) {
        collections.push({path: folderPath, name: collectionName});
    }

    savePreferences({collections, currentCollectionPath: folderPath});
    sendPreferencesToRenderer();
}

function setupMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Collection',
                    click: function handleOpenCollection() {
                        openCollection();
                    }
                },
                {
                    label: 'Preferences',
                    click: function openPreferences() {
                        if (mainWindow) {
                            mainWindow.webContents.send('preferences:open');
                        }
                    }
                },
                {role: 'quit'}
            ] as Electron.MenuItemConstructorOptions[]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(function handleReady() {
    setupMenu();
    launchMainWindow();
    app.on("activate", function handleActivate() {
        if (BrowserWindow.getAllWindows().length === 0) {
            launchMainWindow();
            return;
        }
    });
});

app.on("window-all-closed", function handleWindowAllClosed() {
    if (process.platform !== "darwin") {
        app.quit();
        return;
    }
});

function makeHttpRequest(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
}): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(options.url);
        const isHttps = urlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method,
            headers: options.headers,
            rejectUnauthorized: options.rejectUnauthorized ?? false
        };

        const req = httpModule.request(requestOptions, (res) => {
            const chunks: Buffer[] = [];

            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf-8');
                const headers: Record<string, string> = {};

                if (res.headers) {
                    for (const [key, value] of Object.entries(res.headers)) {
                        if (value !== undefined) {
                            headers[key] = Array.isArray(value) ? value.join(', ') : value;
                        }
                    }
                }

                resolve({
                    ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode || 0,
                    statusText: res.statusMessage || '',
                    headers,
                    body
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

app.once('ready', function handleIPCReady() {
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
    ipcMain.handle('http:request', async function handleHttpRequest(event, options: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
        rejectUnauthorized?: boolean;
    }) {
        return makeHttpRequest(options);
    });
    ipcMain.handle('script:execute', function handleScriptExecute(event, params: ScriptExecutionParams) {
        return executeScript(params);
    });
});
