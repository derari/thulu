import type { CollectionItem, EnvironmentConfig, HttpSection } from './collection';

export { getVerbColor, formatVerb } from './editor/httpColors.js';

export interface DisplayItem {
    item: CollectionItem;
    indent: number;
    isSection: boolean;
    section?: HttpSection;
    isFolder: boolean;
    isFile: boolean;
    hasChildren: boolean;
    folderPath?: string;
    fileKey?: string;
    isEnvironment: boolean;
    environmentConfig?: EnvironmentConfig;
}

export function flattenCollection(
    root: CollectionItem,
    checkCollapsed: (key: string) => boolean
): DisplayItem[] {
    let result = flattenItems(root.items || [], 0, checkCollapsed);
    result.unshift({
        item: { title: 'Environments', environments: root.environments },
        indent: 0,
        isSection: false,
        isFolder: false,
        isFile: false,
        hasChildren: false,
        isEnvironment: true,
        environmentConfig: root.environments || {
            folderPath: root.folderPath!,
            hasPublicEnv: false,
            hasPrivateEnv: false
        }
    });
    return result;
}

export function flattenItems(
    items: CollectionItem[],
    depth: number,
    checkCollapsed: (key: string) => boolean
): DisplayItem[] {
    const result: DisplayItem[] = [];
    for (const item of items) {
        const hasFolder = !!item.folderPath;
        const hasFile = !!item.filePath;
        const hasSections = hasFile && !!item.sections && item.sections.length > 0;
        const hasSubItems = hasFolder && !!item.items && item.items.length > 0;
        const hasEnvironments = !!item.environments;
        // Folder-only environments are shown inline on the folder row, not as child rows
        const hasEnvironmentRow = hasEnvironments && hasFile;
        const hasChildren =
            (hasFolder && hasSubItems) || hasEnvironmentRow || (hasFile && hasSections);
        result.push({
            item: { ...item },
            indent: depth,
            isSection: false,
            isFolder: hasFolder,
            isFile: hasFile,
            hasChildren: hasChildren,
            folderPath: item.folderPath,
            fileKey: item.filePath,
            isEnvironment: false,
            environmentConfig: item.environments
        });

        if (checkCollapsed(item.folderPath || item.filePath || '')) {
            continue;
        }

        if (hasSections) {
            for (const section of item.sections!) {
                result.push({
                    item: {
                        title: section.name,
                        filePath: section.isDivider ? undefined : item.filePath
                    },
                    indent: depth,
                    isSection: true,
                    section: section,
                    isFolder: false,
                    isFile: false,
                    hasChildren: false,
                    isEnvironment: false
                });
            }
            if (hasEnvironmentRow || hasSubItems) {
                result.push({
                    item: { title: '' },
                    indent: depth,
                    isSection: true,
                    section: {
                        name: '',
                        startLineNumber: 0,
                        endLineNumber: 0,
                        verb: '',
                        url: '',
                        isDivider: true,
                        postScripts: []
                    },
                    isFolder: false,
                    isFile: false,
                    hasChildren: false,
                    isEnvironment: false
                });
            }
        }
        if (hasEnvironmentRow) {
            result.push({
                item: { title: 'Environments', environments: item.environments },
                indent: depth + 1,
                isSection: false,
                isFolder: false,
                isFile: false,
                hasChildren: false,
                isEnvironment: true,
                environmentConfig: item.environments
            });
        }
        if (hasSubItems) {
            result.push(...flattenItems(item.items!, depth + 1, checkCollapsed));
        }
    }
    return result;
}
