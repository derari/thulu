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

export function readFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}

export function writeFile(filePath: string, content: string): { success: boolean; error?: string } {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return {success: true};
    } catch (error) {
        console.error('Error writing file:', error);
        return {success: false, error: String(error)};
    }
}

export function listDirectory(dirPath: string): Array<{ name: string; isDirectory: boolean; isFile: boolean }> {
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});
    return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
    }));
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

export function deletePath(targetPath: string): { success: boolean; error?: string } {
    try {
        if (!fs.existsSync(targetPath)) {
            return { success: false, error: 'Path does not exist' };
        }

        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        if (stats.isFile()) {
            fs.unlinkSync(targetPath);
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting path:', error);
        return { success: false, error: String(error) };
    }
}

export function renamePath(oldPath: string, newPath: string): { success: boolean; error?: string } {
    try {
        if (!fs.existsSync(oldPath)) {
            return { success: false, error: 'Path does not exist' };
        }

        if (fs.existsSync(newPath)) {
            return { success: false, error: 'Target path already exists' };
        }

        fs.renameSync(oldPath, newPath);

        return { success: true };
    } catch (error) {
        console.error('Error renaming path:', error);
        return { success: false, error: String(error) };
    }
}

export function createFolder(folderPath: string): { success: boolean; error?: string } {
    try {
        if (fs.existsSync(folderPath)) {
            return { success: false, error: 'Folder already exists' };
        }

        fs.mkdirSync(folderPath, { recursive: true });

        return { success: true };
    } catch (error) {
        console.error('Error creating folder:', error);
        return { success: false, error: String(error) };
    }
}

export function createFile(filePath: string, content: string): { success: boolean; error?: string } {
    try {
        if (fs.existsSync(filePath)) {
            return { success: false, error: 'File already exists' };
        }

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, 'utf-8');

        return { success: true };
    } catch (error) {
        console.error('Error creating file:', error);
        return { success: false, error: String(error) };
    }
}

export function updateCollectionName(collectionPath: string, newName: string): { success: boolean; error?: string } {
    try {
        const thuluJsonPath = path.join(collectionPath, '.thulu.json');

        let config: { collectionName: string } = { collectionName: newName };

        if (fs.existsSync(thuluJsonPath)) {
            const data = fs.readFileSync(thuluJsonPath, 'utf-8');
            config = JSON.parse(data);
            config.collectionName = newName;
        }

        fs.writeFileSync(thuluJsonPath, JSON.stringify(config, null, 2), 'utf-8');

        // Update the collection name in preferences
        const prefs = loadPreferences();
        const collections = prefs.collections || [];
        const collectionIndex = collections.findIndex(c => c.path === collectionPath);

        if (collectionIndex >= 0) {
            collections[collectionIndex].name = newName;
            savePreferences({ collections });
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating collection name:', error);
        return { success: false, error: String(error) };
    }
}

