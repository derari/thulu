export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
	background: {
		primary: string;
		secondary: string;
		tertiary: string;
	};
	text: {
		primary: string;
		secondary: string;
		tertiary: string;
		inverse: string;
	};
	border: {
		default: string;
		focus: string;
		hover: string;
	};
	interactive: {
		primary: string;
		primaryHover: string;
		primaryActive: string;
		secondary: string;
		secondaryHover: string;
		danger: string;
		dangerHover: string;
	};
	state: {
		success: string;
		warning: string;
		error: string;
		info: string;
	};
	sidebar: {
		background: string;
		header: string;
		itemHover: string;
		itemActive: string;
	};
	editor: {
		background: string;
		lineNumber: string;
		selection: string;
		cursor: string;
		bodyBackground: string;
	};
	code: {
		plain: string;
		keyword: string;
		comment: string;
		string: string;
		literal: string;
		highlight1: string;
		highlight2: string;
		disabled: string;
	};
	httpVerb: {
		get: string;
		post: string;
		put: string;
		patch: string;
		delete: string;
		other: string;
	};
	httpStatus: {
		info: string; // 1xx - purple
		success: string; // 2xx - green
		redirect: string; // 3xx - cyan
		clientError: string; // 4xx - yellow
		serverError: string; // 5xx - red
	};
}

export const lightTheme: Theme = {
	background: {
		primary: '#ffffff',
		secondary: '#f9f9f9',
		tertiary: '#f3f3f3'
	},
	text: {
		primary: '#1a1a1a',
		secondary: '#666666',
		tertiary: '#999999',
		inverse: '#ffffff'
	},
	border: {
		default: '#cccccc',
		focus: '#0066cc',
		hover: '#999999'
	},
	interactive: {
		primary: '#0066cc',
		primaryHover: '#0052a3',
		primaryActive: '#003d7a',
		secondary: '#e9e9e9',
		secondaryHover: '#d9d9d9',
		danger: '#cc0000',
		dangerHover: '#990000'
	},
	state: {
		success: '#00cc66',
		warning: '#ff9900',
		error: '#cc0000',
		info: '#0066cc'
	},
	sidebar: {
		background: '#f3f3f3',
		header: '#eaeaea',
		itemHover: '#e9e9e9',
		itemActive: '#d0e8ff'
	},
	editor: {
		background: '#ffffff',
		lineNumber: '#999999',
		selection: '#d0e8ff',
		cursor: '#1a1a1a',
		bodyBackground: '#fafafa'
	},
	code: {
		plain: '#1a1a1a',
		keyword: '#0000ff',
		comment: '#008000',
		string: '#a31515',
		literal: '#098658',
		highlight1: '#af00db',
		highlight2: '#d73a49',
		disabled: '#999999'
	},
	httpVerb: {
		get: '#7c3aed',
		post: '#16a34a',
		put: '#ca8a04',
		patch: '#ca8a04',
		delete: '#dc2626',
		other: '#0891b2'
	},
	httpStatus: {
		info: '#7c3aed', // 1xx - purple (same as GET)
		success: '#16a34a', // 2xx - green (same as POST)
		redirect: '#0891b2', // 3xx - cyan (same as other)
		clientError: '#ca8a04', // 4xx - yellow (same as PUT/PATCH)
		serverError: '#dc2626' // 5xx - red (same as DELETE)
	}
};

export const darkTheme: Theme = {
	background: {
		primary: '#1e1e1e',
		secondary: '#252525',
		tertiary: '#2d2d2d'
	},
	text: {
		primary: '#e0e0e0',
		secondary: '#a0a0a0', //a0a0a0 or c0c0c0
		tertiary: '#707070',
		inverse: '#1e1e1e'
	},
	border: {
		default: '#404040',
		focus: '#4d9fff',
		hover: '#606060'
	},
	interactive: {
		primary: '#4d9fff',
		primaryHover: '#6bb0ff',
		primaryActive: '#89c1ff',
		secondary: '#3a3a3a',
		secondaryHover: '#4a4a4a',
		danger: '#ff4d4d',
		dangerHover: '#ff6b6b'
	},
	state: {
		success: '#4dff99',
		warning: '#ffb84d',
		error: '#ff4d4d',
		info: '#4d9fff'
	},
	sidebar: {
		background: '#252525',
		header: '#2d2d2d',
		itemHover: '#3a3a3a',
		itemActive: '#1a3a52'
	},
	editor: {
		background: '#1e1e1e',
		lineNumber: '#858585',
		selection: '#1a3a52',
		cursor: '#e0e0e0',
		bodyBackground: '#262626'
	},
	code: {
		plain: '#d4d4d4',
		keyword: '#569cd6',
		comment: '#6a9955',
		string: '#ce9178',
		literal: '#b5cea8',
		highlight1: '#c586c0',
		highlight2: '#f97583',
		disabled: '#858585'
	},
	httpVerb: {
		get: '#a78bfa',
		post: '#4ade80',
		put: '#fbbf24',
		patch: '#fbbf24',
		delete: '#f87171',
		other: '#22d3ee'
	},
	httpStatus: {
		info: '#a78bfa', // 1xx - purple (same as GET)
		success: '#4ade80', // 2xx - green (same as POST)
		redirect: '#22d3ee', // 3xx - cyan (same as other)
		clientError: '#fbbf24', // 4xx - yellow (same as PUT/PATCH)
		serverError: '#f87171' // 5xx - red (same as DELETE)
	}
};
