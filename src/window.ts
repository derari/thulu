import {app, BrowserWindow} from 'electron';
import * as path from "path";
import serve from 'electron-serve';
import {loadPreferences, savePreferences} from './preferences.js';

const serveURL = serve({directory: '.'});
const isDev: boolean = !app.isPackaged;
const port: string = process.env.PORT ? process.env.PORT.toString() : '5173';
let mainWindow: BrowserWindow | null;

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

export function launchMainWindow() {
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

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

export function sendPreferencesToRenderer() {
    if (mainWindow) {
        mainWindow.webContents.send('preferences:load', loadPreferences());
    }
}

export function sendPreferencesOpenToRenderer() {
    if (mainWindow) {
        mainWindow.webContents.send('preferences:open');
    }
}
