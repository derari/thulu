import {dialog, Menu} from 'electron';
import {registerCollection} from './collections.js';
import {getMainWindow, sendPreferencesOpenToRenderer, sendPreferencesToRenderer} from './window.js';

async function openCollection() {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) return;

    registerCollection(result.filePaths[0]);
    sendPreferencesToRenderer();
}

export function setupMenu() {
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
                        sendPreferencesOpenToRenderer();
                    }
                },
                {role: 'quit'}
            ] as Electron.MenuItemConstructorOptions[]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
