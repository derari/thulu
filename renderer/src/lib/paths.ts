/** Converts backslashes to forward slashes so paths from any platform compare equal. */
export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/** Last segment of a path, or '' for an empty path. */
export function baseName(filePath: string): string {
    const parts = normalizePath(filePath).split('/');
    return parts[parts.length - 1] || '';
}

/** Everything before the last segment, with forward slashes. */
export function dirName(filePath: string): string {
    const parts = normalizePath(filePath).split('/');
    parts.pop();
    return parts.join('/');
}

/** Joins segments using the separator style of the base path (backslash if it contains one). */
export function joinPath(basePath: string, ...parts: string[]): string {
    const separator = basePath.includes('\\') ? '\\' : '/';
    return [basePath, ...parts].join(separator).replace(/[\\/]+/g, separator);
}

/** Path of `filePath` relative to `rootPath`, or `filePath` unchanged if it is outside the root. */
export function relativePath(filePath: string, rootPath: string): string {
    if (!filePath.startsWith(rootPath)) {
        return filePath;
    }
    return filePath.substring(rootPath.length).replace(/^[\\/]/, '');
}
