export interface CurrentCollection {
	path: string;
	name: string;
	root: CollectionItem;
	metadata: CollectionConfig;
}

export interface CollectionItem {
	title: string;
	folderPath?: string;
	filePath?: string;
	items?: CollectionItem[];
	sections?: HttpSection[];
	environments?: EnvironmentConfig;
	hasReadme: boolean;
}

export interface HttpSection {
	name: string;
	startLineNumber: number;
	endLineNumber: number;
	preamble?: Preamble;
	verb?: string;
	requestStartLineNumber?: number;
	requestEndLineNumber?: number;
	url?: string;
	isDivider: boolean;
	headers?: HttpHeaderSection;
	body?: HttpBodySection;
	postScripts: PostScript[];
}

export interface Preamble {
	startLineNumber: number;
	endLineNumber: number;
	variables: Record<string, string>;
	options: Record<string, string>;
}

export interface PostScript {
	startLineNumber: number;
	endLineNumber: number;
	type: 'file' | 'script';
}

export interface HttpHeaderSection {
	startLineNumber: number;
	endLineNumber: number;
	headers: Record<string, string>;
}

export interface HttpBodySection {
	startLineNumber: number;
	endLineNumber: number;
}

export interface ParsedHttpResponse {
	codeLine: string;
	code: number;
	headers?: HttpHeaderSection;
	body?: HttpBodySection;
	lines: string[];
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
