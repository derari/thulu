import { api } from './api';
import type { EnvironmentConfig } from './collection';
import type { EnvironmentVariable } from './environmentParser';
import { baseName, dirName, joinPath, normalizePath } from './paths';

/**
 * Persistence layer for `http-client.env.json` / `http-client.private.env.json`:
 * file names, walking up the folder tree, and every read or write of those files.
 */

export interface EnvironmentVariables {
    [key: string]: string;
}

export interface EnvironmentFile {
    [environmentName: string]: EnvironmentVariables;
}

export interface EnvironmentFiles {
    public: EnvironmentFile;
    private: EnvironmentFile;
}

export interface ParentSource {
    source: string;
    value: string;
    isPrivate: boolean;
}

export const PUBLIC_ENV_FILE_NAME = 'http-client.env.json';
export const PRIVATE_ENV_FILE_NAME = 'http-client.private.env.json';

export function isEnvironmentFileName(fileName: string): boolean {
    return fileName === PUBLIC_ENV_FILE_NAME || fileName === PRIVATE_ENV_FILE_NAME;
}

export function environmentFilePath(folderPath: string, isPrivate: boolean): string {
    return joinPath(folderPath, isPrivate ? PRIVATE_ENV_FILE_NAME : PUBLIC_ENV_FILE_NAME);
}

/** The folder followed by each of its ancestors up to and including the collection root (forward slashes). */
export function folderAndAncestors(folderPath: string, collectionRoot: string): string[] {
    const root = normalizePath(collectionRoot);
    let current = normalizePath(folderPath);
    const result = [current];

    while (current !== root && current.startsWith(root)) {
        const parent = dirName(current);
        if (parent === current || parent.length < root.length) {
            break;
        }
        result.push(parent);
        current = parent;
    }

    return result;
}

/** Display name of a folder that holds environment files: "root" for the collection root, else its name. */
export function folderLabel(folderPath: string, collectionRoot: string): string {
    return normalizePath(folderPath) === normalizePath(collectionRoot) ? 'root' : baseName(folderPath);
}

function parseEnvironmentFile(content: string): EnvironmentFile {
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to parse environment file:', error);
        return {};
    }
}

/** Reads one env file; a missing, empty or unparsable file yields an empty object. */
export async function readEnvironmentFile(folderPath: string, isPrivate: boolean): Promise<EnvironmentFile> {
    try {
        const content = await api.readFile(environmentFilePath(folderPath, isPrivate));
        return content ? parseEnvironmentFile(content) : {};
    } catch (error) {
        return {};
    }
}

export async function readEnvironmentFiles(folderPath: string): Promise<EnvironmentFiles> {
    const [publicFile, privateFile] = await Promise.all([
        readEnvironmentFile(folderPath, false),
        readEnvironmentFile(folderPath, true)
    ]);
    return { public: publicFile, private: privateFile };
}

export async function writeEnvironmentFile(
    folderPath: string,
    isPrivate: boolean,
    file: EnvironmentFile
): Promise<void> {
    const result = await api.writeFile(
        environmentFilePath(folderPath, isPrivate),
        JSON.stringify(file, null, 2)
    );
    if (result?.success === false) {
        throw new Error(result.error ?? 'Failed to write environment file');
    }
}

async function writeEnvironmentFiles(folderPath: string, files: EnvironmentFiles): Promise<void> {
    await writeEnvironmentFile(folderPath, false, files.public);
    await writeEnvironmentFile(folderPath, true, files.private);
}

/** Creates an empty `http-client.env.json` in the folder. */
export async function createEnvironmentFile(folderPath: string): Promise<{ success: boolean; error?: string }> {
    return api.createFile(environmentFilePath(folderPath, false), '{}');
}

/** Deletes whichever of the folder's env files exist; true if every deletion succeeded. */
export async function deleteEnvironmentFiles(config: EnvironmentConfig): Promise<boolean> {
    const operations: Promise<{ success: boolean; error?: string }>[] = [];

    if (config.hasPublicEnv) {
        operations.push(api.deletePath(environmentFilePath(config.folderPath, false)));
    }
    if (config.hasPrivateEnv) {
        operations.push(api.deletePath(environmentFilePath(config.folderPath, true)));
    }

    const results = await Promise.all(operations);
    return results.every((r) => r.success);
}

/** Writes the folder-local variables of an environment, moving each between the public and private file as flagged. */
export async function saveEnvironmentVariables(
    folderPath: string,
    environmentName: string,
    variables: Pick<EnvironmentVariable, 'name' | 'value' | 'isPrivate' | 'isEditable' | 'isInherited'>[],
    deletedNames: Set<string>
): Promise<void> {
    const files = await readEnvironmentFiles(folderPath);
    const publicVars = files.public[environmentName] || {};
    const privateVars = files.private[environmentName] || {};

    for (const variable of variables) {
        const isDeleted = deletedNames.has(variable.name);
        if (variable.isEditable && !isDeleted) {
            if (variable.isPrivate) {
                privateVars[variable.name] = variable.value;
                delete publicVars[variable.name];
            } else {
                publicVars[variable.name] = variable.value;
                delete privateVars[variable.name];
            }
        } else if (variable.isInherited || isDeleted) {
            delete publicVars[variable.name];
            delete privateVars[variable.name];
        }
    }

    files.public[environmentName] = publicVars;
    files.private[environmentName] = privateVars;
    await writeEnvironmentFiles(folderPath, files);
}

export async function createEnvironment(folderPath: string, environmentName: string): Promise<void> {
    const publicFile = await readEnvironmentFile(folderPath, false);
    publicFile[environmentName] = {};
    await writeEnvironmentFile(folderPath, false, publicFile);
}

export async function deleteEnvironment(folderPath: string, environmentName: string): Promise<void> {
    const files = await readEnvironmentFiles(folderPath);
    delete files.public[environmentName];
    delete files.private[environmentName];
    await writeEnvironmentFiles(folderPath, files);
}

export async function renameEnvironment(folderPath: string, oldName: string, newName: string): Promise<void> {
    const files = await readEnvironmentFiles(folderPath);

    for (const file of [files.public, files.private]) {
        if (file[oldName]) {
            file[newName] = file[oldName];
            delete file[oldName];
        }
    }

    await writeEnvironmentFiles(folderPath, files);
}

/** Values a variable has in the ancestor folders of `folderPath`, nearest ancestor first. */
export async function getVariableParentSources(
    environmentName: string,
    variableName: string,
    folderPath: string,
    collectionRoot: string
): Promise<ParentSource[]> {
    const sources: ParentSource[] = [];

    for (const ancestor of folderAndAncestors(folderPath, collectionRoot).slice(1)) {
        for (const isPrivate of [false, true]) {
            const file = await readEnvironmentFile(ancestor, isPrivate);
            const value = file[environmentName]?.[variableName];
            if (value !== undefined) {
                sources.push({ source: baseName(ancestor), value, isPrivate });
            }
        }
    }

    return sources;
}
