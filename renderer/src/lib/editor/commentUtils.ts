import { EditorView } from '@codemirror/view';

export function toggleLineComment(view: EditorView, lineNumber: number): void {
	const line = view.state.doc.line(lineNumber);
	const lineText = line.text;
	const trimmed = lineText.trim();

	let newText: string;
	if (trimmed.startsWith('#')) {
		const hashIndex = lineText.indexOf('#');
		const afterHash = lineText.substring(hashIndex + 1);
		const leadingSpaces = lineText.substring(0, hashIndex);
		newText = leadingSpaces + (afterHash.startsWith(' ') ? afterHash.substring(1) : afterHash);
	} else if (trimmed.startsWith('//')) {
		const slashIndex = lineText.indexOf('//');
		const afterSlash = lineText.substring(slashIndex + 2);
		const leadingSpaces = lineText.substring(0, slashIndex);
		newText = leadingSpaces + (afterSlash.startsWith(' ') ? afterSlash.substring(1) : afterSlash);
	} else {
		const firstNonSpace = lineText.search(/\S/);
		if (firstNonSpace === -1) {
			newText = '# ' + lineText;
		} else {
			newText = lineText.substring(0, firstNonSpace) + '# ' + lineText.substring(firstNonSpace);
		}
	}

	view.dispatch({
		changes: { from: line.from, to: line.to, insert: newText }
	});
}

