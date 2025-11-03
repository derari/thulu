// hello copilot
import {app, BrowserWindow, ipcMain, Menu, dialog} from "electron";
import * as path from "path";
import * as fs from "fs";
import serve from 'electron-serve';

const serveURL = serve({directory: '.'});
const isDev: boolean = !app.isPackaged;
const port: string = process.env.PORT ? process.env.PORT.toString() : '5173';
const preferencesFileName = 'preferences.json';
let mainWindow: BrowserWindow | null;

function getPreferencesFilePath() {
    return path.join(app.getPath('userData'), preferencesFileName);
}

function loadPreferences(): Preferences {
    const filePath = getPreferencesFilePath();
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const prefs = JSON.parse(data) as Preferences;
        const windowWidth = prefs.windowWidth && prefs.windowWidth >= 50 ? prefs.windowWidth : 800;
        const windowHeight = prefs.windowHeight && prefs.windowHeight >= 50 ? prefs.windowHeight : 600;
        const sidebarWidth = prefs.sidebarWidth && prefs.sidebarWidth >= 50 ? prefs.sidebarWidth : 100;
        return {...prefs, windowWidth, windowHeight, sidebarWidth};
    }
    return {appearance: 'system', windowWidth: 800, windowHeight: 600, sidebarWidth: 100};
}

function savePreferences(partial: Partial<Preferences>) {
    const filePath = getPreferencesFilePath();
    const current = loadPreferences();
    const updated = {...current, ...partial};
    fs.writeFileSync(filePath, JSON.stringify(updated));
}

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
            const prefs = loadPreferences();
            savePreferences({...prefs, windowWidth: width, windowHeight: height});
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

function getProcessVersions() {
  const processVersions: ProcessVersions = process.versions;
  console.log("sending processVersions to IPC to pass on to renderer");
  return processVersions;
}

interface ScannedCollectionItem {
  title: string;
  folderPath?: string;
  filePath?: string;
  items?: ScannedCollectionItem[];
  environments?: {
    folderPath: string;
    hasPublicEnv: boolean;
    hasPrivateEnv: boolean;
  };
}

function scanCollectionFolder(folderPath: string): ScannedCollectionItem[] {
  if (!fs.existsSync(folderPath)) {
    return [];
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const itemMap = new Map<string, ScannedCollectionItem>();

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    if (entry.name === 'http-client.env.json' || entry.name === 'http-client.private.env.json') {
      continue;
    }

    const fullPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      let existing = itemMap.get(entry.name);
      if (!existing) {
        existing = { title: entry.name };
        itemMap.set(entry.name, existing);
      }

      existing.folderPath = fullPath;
      existing.items = scanCollectionFolder(fullPath);

      const publicEnvPath = path.join(fullPath, 'http-client.env.json');
      const privateEnvPath = path.join(fullPath, 'http-client.private.env.json');
      const hasPublicEnv = fs.existsSync(publicEnvPath);
      const hasPrivateEnv = fs.existsSync(privateEnvPath);

      if (hasPublicEnv || hasPrivateEnv) {
        existing.environments = {
          folderPath: fullPath,
          hasPublicEnv,
          hasPrivateEnv
        };
      }

      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.http')) {
      const title = entry.name.substring(0, entry.name.length - 5);
      const existing = itemMap.get(title);
      if (existing) {
        existing.filePath = fullPath;
      }
      if (!existing) {
        itemMap.set(title, {
          title: title,
          filePath: fullPath
        });
      }
    }
  }

  return Array.from(itemMap.values());
}

function scanCollectionRoot(folderPath: string): ScannedCollectionItem[] {
  const items = scanCollectionFolder(folderPath);

  const publicEnvPath = path.join(folderPath, 'http-client.env.json');
  const privateEnvPath = path.join(folderPath, 'http-client.private.env.json');
  const hasPublicEnv = fs.existsSync(publicEnvPath);
  const hasPrivateEnv = fs.existsSync(privateEnvPath);

  if (hasPublicEnv || hasPrivateEnv) {
    items.unshift({
      title: 'Environments',
      environments: {
        folderPath,
        hasPublicEnv,
        hasPrivateEnv
      }
    });
  }

  return items;
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

app.once('ready', function handleIPCReady() {
    ipcMain.handle('renderer:requestProcessVersions', function handleRequestProcessVersions() {
        console.log("Renderer is asking for process versions");
        return getProcessVersions();
    });
    ipcMain.handle('collection:loadItems', function handleLoadCollectionItems(event, collectionPath: string) {
        return scanCollectionRoot(collectionPath);
    });
    ipcMain.handle('http:readFile', function handleReadHttpFile(event, filePath: string) {
        if (!fs.existsSync(filePath)) {
            return '';
        }
        return fs.readFileSync(filePath, 'utf-8');
    });
    ipcMain.handle('http:writeFile', function handleWriteHttpFile(event, filePath: string, content: string) {
        try {
            fs.writeFileSync(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            console.error('Error writing file:', error);
            return { success: false, error: String(error) };
        }
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
    }) {
        const response = await fetch(options.url, {
            method: options.method,
            headers: options.headers,
            body: options.body
        });

        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        const body = await response.text();

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers,
            body
        };
    });
});
