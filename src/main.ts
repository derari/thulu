import {app, BrowserWindow} from 'electron';
import {registerIpcHandlers} from './ipc.js';
import {setupMenu} from './menu.js';
import {launchMainWindow} from './window.js';

app.whenReady().then(function handleReady() {
    registerIpcHandlers();
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
