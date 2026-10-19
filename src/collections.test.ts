import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {registerCollection, updateCollectionName} from './collections.js';
import {loadPreferences, savePreferences} from './preferences.js';

let userData: string;
let collectionDir: string;

vi.mock('electron', () => ({
    app: {
        getPath: () => userData
    }
}));

beforeEach(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'thulu-prefs-'));
    collectionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thulu-collection-'));
});

afterEach(() => {
    fs.rmSync(userData, {recursive: true, force: true});
    fs.rmSync(collectionDir, {recursive: true, force: true});
});

function readConfig() {
    return JSON.parse(fs.readFileSync(path.join(collectionDir, '.thulu.json'), 'utf-8'));
}

describe('registerCollection', () => {
    it('creates .thulu.json named after the folder and makes the collection current', () => {
        registerCollection(collectionDir);

        const name = path.basename(collectionDir);
        expect(readConfig()).toEqual({collectionName: name});
        const prefs = loadPreferences();
        expect(prefs.collections).toEqual([{path: collectionDir, name}]);
        expect(prefs.currentCollectionPath).toBe(collectionDir);
    });

    it('uses the name from an existing .thulu.json', () => {
        fs.writeFileSync(path.join(collectionDir, '.thulu.json'), JSON.stringify({collectionName: 'My API'}));

        registerCollection(collectionDir);

        expect(loadPreferences().collections).toEqual([{path: collectionDir, name: 'My API'}]);
    });

    it('keeps the saved state when the collection is registered again', () => {
        savePreferences({collections: [{path: collectionDir, name: 'old', collapsedPaths: ['a']}]});

        registerCollection(collectionDir);

        const [collection] = loadPreferences().collections!;
        expect(collection.collapsedPaths).toEqual(['a']);
        expect(collection.name).toBe(path.basename(collectionDir));
    });

    it('keeps other registered collections', () => {
        savePreferences({collections: [{path: '/other', name: 'other'}]});

        registerCollection(collectionDir);

        expect(loadPreferences().collections).toHaveLength(2);
    });
});

describe('updateCollectionName', () => {
    it('renames in .thulu.json and the preferences', () => {
        registerCollection(collectionDir);

        const result = updateCollectionName(collectionDir, 'Renamed');

        expect(result).toEqual({success: true});
        expect(readConfig()).toEqual({collectionName: 'Renamed'});
        expect(loadPreferences().collections![0].name).toBe('Renamed');
    });

    it('creates .thulu.json when missing', () => {
        updateCollectionName(collectionDir, 'Fresh');

        expect(readConfig()).toEqual({collectionName: 'Fresh'});
    });

    it('reports a corrupt config as an error', () => {
        fs.writeFileSync(path.join(collectionDir, '.thulu.json'), '{nope');

        const result = updateCollectionName(collectionDir, 'X');

        expect(result.success).toBe(false);
    });
});
