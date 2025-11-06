import { EditorView, gutter, GutterMarker } from '@codemirror/view';
import type { RangeSet } from '@codemirror/state';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';

type FormatToggleCallback = () => void;

class FormatToggleMarker extends GutterMarker {
	constructor(
		private isFormatted: boolean,
		private onToggle: FormatToggleCallback
	) {
		super();
	}

	eq(other: GutterMarker): boolean {
		return (
			other instanceof FormatToggleMarker &&
			other.isFormatted === this.isFormatted &&
			other.onToggle === this.onToggle
		);
	}

	toDOM() {
		const icon = document.createElement('span');
		icon.className = 'format-toggle-icon';
		icon.textContent = this.isFormatted ? '{ }' : '{…}';
		icon.title = this.isFormatted ? 'Show raw' : 'Format';
		icon.style.cursor = 'pointer';
		icon.style.fontSize = '12px';
		icon.style.userSelect = 'none';
		icon.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.onToggle();
		});
		return icon;
	}
}

export const setFormatStateEffect = StateEffect.define<{
	bodyStartLine: number;
	isFormatted: boolean;
	canFormat: boolean;
}>();

export const formatStateField = StateField.define<{
	bodyStartLine: number;
	isFormatted: boolean;
	canFormat: boolean;
}>({
	create() {
		return {
			bodyStartLine: 0,
			isFormatted: false,
			canFormat: false
		};
	},
	update(state, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setFormatStateEffect)) {
				return { ...state, ...effect.value };
			}
		}
		return state;
	}
});

export const setFormatToggleCallback = StateEffect.define<FormatToggleCallback>();

export const formatToggleCallbackField = StateField.define<FormatToggleCallback | null>({
	create() {
		return null;
	},
	update(callback, tr) {
		for (const effect of tr.effects) {
			if (effect.is(setFormatToggleCallback)) {
				return effect.value;
			}
		}
		return callback;
	}
});

export const responseFormatGutterExtension = [
	formatStateField,
	formatToggleCallbackField,
	gutter({
		class: 'cm-response-format-gutter',
		markers: (view: EditorView): RangeSet<GutterMarker> => {
			const builder = new RangeSetBuilder<GutterMarker>();

			const state = view.state.field(formatStateField);
			const callback = view.state.field(formatToggleCallbackField);

			if (!state.canFormat || !callback || state.bodyStartLine === 0) {
				return builder.finish();
			}

			try {
				const line = view.state.doc.line(state.bodyStartLine);
				const marker = new FormatToggleMarker(state.isFormatted, callback);
				builder.add(line.from, line.from, marker);
				return builder.finish();
			} catch {
				return builder.finish();
			}
		},
		renderEmptyElements: false
	})
];
