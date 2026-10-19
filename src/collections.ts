import * as fs from "fs";
import * as path from "path";
import {loadPreferences, savePreferences} from './preferences.js';
import type {FileOperationResult} from './shared/ipc.js';

const CONFIG_FILE_NAME = '.thulu.json';

interface CollectionConfig {
    collectionName: string;
}

function readConfig(collectionPath: string): CollectionConfig | null {
    const configPath = path.join(collectionPath, CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function writeConfig(collectionPath: string, config: CollectionConfig) {
    fs.writeFileSync(path.join(collectionPath, CONFIG_FILE_NAME), JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Makes a folder the current collection: creates its `.thulu.json` if missing, adds it to the
 * preferences' collection list (keeping its saved state) and marks it as current.
 */
export function registerCollection(folderPath: string): void {
    const folderName = path.basename(folderPath);
    const config = readConfig(folderPath);
    const collectionName = config?.collectionName || folderName;

    if (!config) {
        writeConfig(folderPath, {collectionName: folderName});
    }

    const collections = loadPreferences().collections || [];
    const existingIndex = collections.findIndex(c => c.path === folderPath);
    if (existingIndex >= 0) {
        collections[existingIndex] = {...collections[existingIndex], name: collectionName};
    } else {
        collections.push({path: folderPath, name: collectionName});
    }

    savePreferences({collections, currentCollectionPath: folderPath});
}

export function updateCollectionName(collectionPath: string, newName: string): FileOperationResult {
    try {
        const config = readConfig(collectionPath) ?? {collectionName: newName};
        config.collectionName = newName;
        writeConfig(collectionPath, config);

        const collections = loadPreferences().collections || [];
        const collection = collections.find(c => c.path === collectionPath);
        if (collection) {
            collection.name = newName;
            savePreferences({collections});
        }

        return {success: true};
    } catch (error) {
        console.error('Error updating collection name:', error);
        return {success: false, error: String(error)};
    }
}
