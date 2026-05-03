import {app, BrowserWindow, dialog, ipcMain, Menu, shell} from 'electron';
import * as path from "path";
import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import serve from 'electron-serve';
import {
    createFile,
    createFolder,
    deletePath,
    fileExists,
    listDirectory,
    listHistoryEntries,
    loadPreferences,
    readFile,
    readFileBinary,
    renamePath,
    saveHistoryEntry,
    type SaveHistoryParams,
    savePreferences,
    updateCollectionName,
    writeFile
} from './fileOperations.js';
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

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 10;

interface HttpRawResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
}

interface RedirectHop {
    status: number;
    method: string;
    url: string;
}

function makeSingleHttpRequest(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
}): Promise<HttpRawResponse> {
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
                const body = Buffer.concat(chunks).toString('base64');
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

async function makeHttpRequest(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
    followRedirects?: boolean;
}): Promise<HttpRawResponse & { redirects: RedirectHop[] }> {
    const followRedirects = options.followRedirects ?? true;
    const redirects: RedirectHop[] = [];

    let currentUrl = options.url;
    let currentMethod = options.method;
    let currentBody: string | undefined = options.body;

    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
        const response = await makeSingleHttpRequest({
            url: currentUrl,
            method: currentMethod,
            headers: options.headers,
            body: currentBody,
            rejectUnauthorized: options.rejectUnauthorized
        });

        if (!followRedirects || !REDIRECT_STATUSES.has(response.status)) {
            return { ...response, redirects };
        }

        if (attempt === MAX_REDIRECTS) {
                const hopList = redirects.map(r => `  -> ${r.status} ${r.method}: ${r.url}`).join('\n');
                throw new Error(`Too many redirects (max ${MAX_REDIRECTS}):\n${hopList}`);
        }

        const location = response.headers['location'];
        if (!location) {
            return { ...response, redirects };
        }

        // Resolve relative redirects
        const nextUrl = new URL(location, currentUrl).toString();

        // Determine the method for the next request
        let nextMethod = currentMethod;
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
            nextMethod = 'GET';
        }

        redirects.push({ status: response.status, method: nextMethod, url: nextUrl });

        currentUrl = nextUrl;
        currentMethod = nextMethod;
        // Body is dropped when switching to GET
        if (nextMethod === 'GET') {
            currentBody = undefined;
        }
    }

    throw new Error('Redirect loop');
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
    ipcMain.handle('http:request', async function handleHttpRequest(event, options: {
        url: string;
        method: string;
        headers: Record<string, string>;
        body?: string;
        rejectUnauthorized?: boolean;
        followRedirects?: boolean;
    }) {
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
});
