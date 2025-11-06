import type {CollectionItem, EnvironmentConfig, HttpSection} from './collection';

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

export function formatVerb(verb: string): string {
    const upper = verb.toUpperCase();
    if (upper === 'PATCH') return 'PTCH';
    if (upper === 'DELETE') return 'DEL';
    if (upper === 'OPTIONS') return 'OPT';
    return upper.substring(0, 4);
}

export function getVerbColor(verb: string): string {
    const upper = verb.toUpperCase();
    switch (upper) {
        case 'GET':
            return 'var(--http-verb-get)';
        case 'POST':
            return 'var(--http-verb-post)';
        case 'PUT':
            return 'var(--http-verb-put)';
        case 'PATCH':
            return 'var(--http-verb-patch)';
        case 'DELETE':
            return 'var(--http-verb-delete)';
        default:
            return 'var(--http-verb-other)';
    }
}

export function flattenCollection(root: CollectionItem, checkCollapsed: (key: string) => boolean): DisplayItem[] {
    let result = flattenItems(root.items || [], 0, checkCollapsed);
    result.unshift({
        item: {title: 'Environments', environments: root.environments},
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

export function flattenItems(items: CollectionItem[], depth: number, checkCollapsed: (key: string) => boolean): DisplayItem[] {
    const result: DisplayItem[] = [];
    for (const item of items) {
        const hasFolder = !!item.folderPath;
        const hasFile = !!item.filePath;
        const hasSections = hasFile && !!item.sections && item.sections.length > 0;
        const hasSubItems = hasFolder && !!item.items && item.items.length > 0;
        const hasEnvironments = !!item.environments;
        const hasChildren = (hasFolder && (hasSubItems || hasEnvironments)) || (hasFile && hasSections);
        result.push({
            item: {...item},
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
			if (hasEnvironments || hasSubItems) {
				result.push({
					item: {title: ''},
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
        if (hasEnvironments) {
            result.push({
                item: {title: 'Environments', environments: item.environments},
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

