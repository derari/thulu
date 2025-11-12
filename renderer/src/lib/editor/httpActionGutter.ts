import { EditorView, gutter, GutterMarker } from '@codemirror/view';
import { RangeSetBuilder, StateField } from '@codemirror/state';
import type { HttpSection } from '../collection';
import { parseHttpFile } from './httpParser.js';

type RequestExecutor = (sectionLineNumber: number) => void;

class PlayIconMarker extends GutterMarker {
	constructor(
		private sectionLineNumber: number,
		private executeRequest: RequestExecutor
	) {
		super();
	}

	eq(other: GutterMarker): boolean {
		return (
			other instanceof PlayIconMarker &&
			other.sectionLineNumber === this.sectionLineNumber &&
			other.executeRequest === this.executeRequest
		);
	}

	toDOM() {
		const icon = document.createElement('span');
		icon.className = 'http-play-icon';
		icon.textContent = '▶';
		icon.title = 'Execute request';
		icon.style.cursor = 'pointer';
		icon.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.executeRequest(this.sectionLineNumber);
		});
		return icon;
	}
}

class CommentToggleMarker extends GutterMarker {
	constructor(
		private isComment: boolean,
		private lineNumber: number,
		private currentTheme: string
	) {
		super();
	}

	eq(other: GutterMarker): boolean {
		return (
			other instanceof CommentToggleMarker &&
			other.isComment === this.isComment &&
			other.lineNumber === this.lineNumber
		);
	}

	toDOM(view: EditorView) {
		const button = document.createElement('button');
		button.className = 'cm-comment-toggle-marker';
		button.setAttribute('aria-label', this.isComment ? 'Uncomment line' : 'Comment line');
		button.style.cssText = `
			background: none;
			border: none;
			cursor: pointer;
			padding: 0;
			width: 16px;
			height: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			opacity: 0.6;
			transition: opacity 0.2s;
		`;

		const svg = this.createSvgIcon();
		button.appendChild(svg);

		button.onmouseenter = () => {
			button.style.opacity = '1';
		};

		button.onmouseleave = () => {
			button.style.opacity = '0.6';
		};

		button.onclick = (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleComment(view, this.lineNumber);
		};

		return button;
	}

	private createSvgIcon(): SVGElement {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('width', '16');
		svg.setAttribute('height', '16');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.style.display = 'block';

		if (this.isComment) {
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', '8');
			circle.setAttribute('cy', '8');
			circle.setAttribute('r', '6');
			circle.setAttribute('fill', 'none');
			circle.setAttribute('stroke', this.getColor());
			circle.setAttribute('stroke-width', '1.5');
			svg.appendChild(circle);
		} else {
			const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', '8');
			circle.setAttribute('cy', '8');
			circle.setAttribute('r', '6');
			circle.setAttribute('fill', 'none');
			circle.setAttribute('stroke', this.getColor());
			circle.setAttribute('stroke-width', '1.5');
			svg.appendChild(circle);

			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', 'M 5 8 L 7 10 L 11 6');
			path.setAttribute('fill', 'none');
			path.setAttribute('stroke', this.getColor());
			path.setAttribute('stroke-width', '1.5');
			path.setAttribute('stroke-linecap', 'round');
			path.setAttribute('stroke-linejoin', 'round');
			svg.appendChild(path);
		}

		return svg;
	}

	private getColor(): string {
		if (this.currentTheme === 'dark') {
			return '#c586c0';
		}
		return '#af00db';
	}

	private toggleComment(view: EditorView, lineNumber: number) {
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
}

function isLineComment(line: string): boolean {
	const trimmed = line.trim();
	return trimmed.startsWith('#') || trimmed.startsWith('//');
}

function createSectionsField(initialSections: HttpSection[] = []) {
	return StateField.define<HttpSection[]>({
		create() {
			return initialSections;
		},
		update(sections, tr) {
			if (tr.docChanged) {
				const parsed = parseHttpFile(tr.newDoc.toString());
				return parsed.sections;
			}
			return sections;
		}
	});
}

function createRequestExecutorField(initialExecutor: RequestExecutor | null = null) {
	return StateField.define<RequestExecutor | null>({
		create() {
			return initialExecutor;
		},
		update(executor) {
			return executor;
		}
	});
}

function createThemeField(initialTheme: string = 'light') {
	return StateField.define<string>({
		create() {
			return initialTheme;
		},
		update(theme) {
			return theme;
		}
	});
}

export function createHttpActionGutterExtension(
	executor: RequestExecutor,
	sections: HttpSection[],
	currentTheme: string = 'light'
) {
	const sectionsFieldWithInit = createSectionsField(sections);
	const executorFieldWithInit = createRequestExecutorField(executor);
	const themeFieldWithInit = createThemeField(currentTheme);

	return [
		sectionsFieldWithInit,
		executorFieldWithInit,
		themeFieldWithInit,
		gutter({
			class: 'cm-http-action-gutter',
			markers: (view: EditorView) => {
				const builder = new RangeSetBuilder<GutterMarker>();
				const secs = view.state.field(sectionsFieldWithInit);
				const exec = view.state.field(executorFieldWithInit);
				const theme = view.state.field(themeFieldWithInit);

				if (!exec) {
					return builder.finish();
				}

				for (const section of secs) {
					if (!section.requestStartLineNumber || !section.requestEndLineNumber) {
						continue;
					}

					if (!section.isDivider) {
						const line = view.state.doc.line(section.requestStartLineNumber);
						const marker = new PlayIconMarker(section.startLineNumber, exec);
						builder.add(line.from, line.from, marker);
					}

					const startLine = section.requestStartLineNumber + 1;
					let endLine = section.requestEndLineNumber - 1;

					if (section.headers && section.headers.endLineNumber) {
						endLine = section.headers.endLineNumber - 1;
					}

					if (section.body && section.body.startLineNumber) {
						endLine = Math.min(endLine, section.body.startLineNumber - 1);
					}

					for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
						if (lineNum > view.state.doc.lines) {
							break;
						}

						const line = view.state.doc.line(lineNum);
						const lineText = line.text.trim();

						if (lineText === '') {
							continue;
						}

						const isComment = isLineComment(line.text);
						const marker = new CommentToggleMarker(isComment, lineNum, theme);
						builder.add(line.from, line.from, marker);
					}
				}

				return builder.finish();
			},
			renderEmptyElements: true
		})
	];
}
