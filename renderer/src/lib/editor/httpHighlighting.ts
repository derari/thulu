import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Tag, tags } from '@lezer/highlight';

// Custom tag for HTTP status codes
export const statusCodeTag = Tag.define();

export const httpHighlightStyle = HighlightStyle.define([
	{ tag: tags.meta, color: 'var(--code-disabled)' },
	{ tag: tags.heading, color: 'var(--code-highlight1)', fontWeight: 'bold' },
	{ tag: tags.strong, color: 'var(--code-highlight2)', fontWeight: 'bold' },
	{ tag: tags.keyword, color: 'var(--code-keyword)' },
	{ tag: tags.comment, color: 'var(--code-comment)' },
	{ tag: tags.string, color: 'var(--code-string)' },
	{ tag: tags.number, color: 'var(--code-literal)' },
	{ tag: tags.bool, color: 'var(--code-literal)' },
	{ tag: tags.null, color: 'var(--code-literal)' },
	{ tag: tags.atom, color: 'var(--code-literal)' },
	{ tag: tags.punctuation, color: 'var(--code-plain)' },
	{ tag: statusCodeTag, fontWeight: 'bold' }
]);

export const httpSyntaxHighlighting = syntaxHighlighting(httpHighlightStyle);
