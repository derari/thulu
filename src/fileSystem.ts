import * as fs from "fs";
import * as path from "path";
import type {DirectoryEntry, FileOperationResult} from './shared/ipc.js';

export function readFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}

export function readFileBinary(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
}

export function writeFile(filePath: string, content: string): FileOperationResult {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return {success: true};
    } catch (error) {
        console.error('Error writing file:', error);
        return {success: false, error: String(error)};
    }
}

export function listDirectory(dirPath: string): DirectoryEntry[] {
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

export function deletePath(targetPath: string): FileOperationResult {
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

export function renamePath(oldPath: string, newPath: string): FileOperationResult {
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

export function createFolder(folderPath: string): FileOperationResult {
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

export function createFile(filePath: string, content: string): FileOperationResult {
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
