export interface CurrentCollection {
    path: string;
    name: string;
    items: CollectionItem[];
    metadata: CollectionConfig;
}

export interface CollectionItem {
    title: string;
    folderPath?: string;
    filePath?: string;
    items?: CollectionItem[];
    sections?: HttpSection[];
		environments?: EnvironmentConfig;
}

export interface HttpSection {
    name: string;
    lineNumber: number;
    verb?: string;
    verbLine?: number;
    url?: string;
    isDivider?: boolean;
}

export interface EnvironmentConfig {
    folderPath: string;
    hasPublicEnv: boolean;
    hasPrivateEnv: boolean;
}

export interface CollectionConfig {
    collectionName: string;
}

export interface OpenFile {
    filePath: string;
    content: string;
    sectionLineNumber?: number;
}

