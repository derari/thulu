interface ContentTypeInfo {
	extension: string;
	isBinary: boolean;
}

const CONTENT_TYPE_MAPPINGS: Array<{ pattern: RegExp; extension: string; isBinary: boolean }> = [
	// JSON
	{ pattern: /^application\/json\b/i, extension: '.json', isBinary: false },
	{ pattern: /^text\/json\b/i, extension: '.json', isBinary: false },
	// XML
	{ pattern: /^application\/xml\b/i, extension: '.xml', isBinary: false },
	{ pattern: /^text\/xml\b/i, extension: '.xml', isBinary: false },
	// HTML
	{ pattern: /^text\/html\b/i, extension: '.html', isBinary: false },
	{ pattern: /^application\/xhtml\+xml\b/i, extension: '.html', isBinary: false },
	// Text subtypes
	{ pattern: /^text\/plain\b/i, extension: '.txt', isBinary: false },
	{ pattern: /^text\/css\b/i, extension: '.css', isBinary: false },
	{ pattern: /^text\/csv\b/i, extension: '.csv', isBinary: false },
	{ pattern: /^text\//i, extension: '.txt', isBinary: false },
	// JavaScript
	{ pattern: /^application\/javascript\b/i, extension: '.js', isBinary: false },
	{ pattern: /^text\/javascript\b/i, extension: '.js', isBinary: false },
	// Form data
	{ pattern: /^application\/x-www-form-urlencoded\b/i, extension: '.txt', isBinary: false },
	// SVG (text-based image)
	{ pattern: /^image\/svg\+xml\b/i, extension: '.svg', isBinary: false },
	// Binary images
	{ pattern: /^image\/png\b/i, extension: '.png', isBinary: true },
	{ pattern: /^image\/jpeg\b/i, extension: '.jpg', isBinary: true },
	{ pattern: /^image\/gif\b/i, extension: '.gif', isBinary: true },
	{ pattern: /^image\/webp\b/i, extension: '.webp', isBinary: true },
	{ pattern: /^image\//i, extension: '.bin', isBinary: true },
	// Audio / video
	{ pattern: /^audio\/mpeg\b/i, extension: '.mp3', isBinary: true },
	{ pattern: /^audio\/wav\b/i, extension: '.wav', isBinary: true },
	{ pattern: /^audio\/wave\b/i, extension: '.wav', isBinary: true },
	{ pattern: /^audio\/ogg\b/i, extension: '.ogg', isBinary: true },
	{ pattern: /^audio\/flac\b/i, extension: '.flac', isBinary: true },
	{ pattern: /^audio\/aac\b/i, extension: '.aac', isBinary: true },
	{ pattern: /^audio\//i, extension: '.bin', isBinary: true },
	{ pattern: /^video\/mp4\b/i, extension: '.mp4', isBinary: true },
	{ pattern: /^video\/mpeg\b/i, extension: '.mpeg', isBinary: true },
	{ pattern: /^video\/ogg\b/i, extension: '.ogv', isBinary: true },
	{ pattern: /^video\/webm\b/i, extension: '.webm', isBinary: true },
	{ pattern: /^video\/quicktime\b/i, extension: '.mov', isBinary: true },
	{ pattern: /^video\/x-msvideo\b/i, extension: '.avi', isBinary: true },
	{ pattern: /^video\//i, extension: '.bin', isBinary: true },
	// Common binary application types
	{ pattern: /^application\/pdf\b/i, extension: '.pdf', isBinary: true },
	{ pattern: /^application\/zip\b/i, extension: '.zip', isBinary: true },
	{ pattern: /^application\/gzip\b/i, extension: '.gz', isBinary: true },
	{ pattern: /^application\/octet-stream\b/i, extension: '.bin', isBinary: true },
	{ pattern: /^application\/x-protobuf\b/i, extension: '.bin', isBinary: true },
	{ pattern: /^multipart\//i, extension: '.bin', isBinary: true },
	// General fallback patterns (from content-type name)
	{ pattern: /\bjson\b/i, extension: '.json', isBinary: false },
	{ pattern: /\bxml\b/i, extension: '.xml', isBinary: false },
	{ pattern: /\bhtml\b/i, extension: '.html', isBinary: false },
];

function getContentTypeInfo(contentType: string | null): ContentTypeInfo {
	if (!contentType) return { extension: '.bin', isBinary: false };
	const mimeType = contentType.split(';')[0].trim();
	for (const mapping of CONTENT_TYPE_MAPPINGS) {
		if (mapping.pattern.test(mimeType)) {
			return { extension: mapping.extension, isBinary: mapping.isBinary };
		}
	}
	return { extension: '.bin', isBinary: false };
}

export function getExtensionForContentType(contentType: string | null): string {
	return getContentTypeInfo(contentType).extension;
}

export function isBinaryContentType(contentType: string | null): boolean {
	return getContentTypeInfo(contentType).isBinary;
}

