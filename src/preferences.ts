import * as fs from "fs";
import * as path from "path";
import {app} from "electron";

const preferencesFileName = 'preferences.json';

function getPreferencesFilePath() {
    return path.join(app.getPath('userData'), preferencesFileName);
}

export function loadPreferences(): Preferences {
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

export function savePreferences(partial: Partial<Preferences>) {
    const filePath = getPreferencesFilePath();
    const current = loadPreferences();
    const updated = {...current, ...partial};
    fs.writeFileSync(filePath, JSON.stringify(updated));
}
