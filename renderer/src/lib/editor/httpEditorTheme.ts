import { EditorView } from '@codemirror/view';

export const httpEditorTheme = EditorView.theme({
    '&': {
        color: 'var(--code-plain)',
        backgroundColor: 'var(--editor-bg)'
    },
    '.cm-content': {
        caretColor: 'var(--editor-cursor)'
    },
    '.cm-cursor, &.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--editor-cursor)'
    },
    '.cm-selectionBackground, ::selection': {
        backgroundColor: 'var(--editor-selection)'
    },
    '&.cm-focused .cm-selectionBackground, &.cm-focused ::selection': {
        backgroundColor: 'var(--editor-selection)'
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--bg-secondary)'
    },
    '.cm-gutters': {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--editor-line-number)',
        border: 'none',
        borderRight: '1px solid var(--border-default)'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'var(--bg-secondary)'
    },
    '.http-body-line': {
        backgroundColor: 'var(--editor-body-bg)'
    },
    '.http-body-error-line': {
        backgroundColor: 'var(--state-error)',
        opacity: '0.1'
    },
    '.cm-http-action-gutter': {
        width: '20px',
        minWidth: '20px',
        backgroundColor: 'var(--bg-secondary)',
        paddingLeft: '2px',
        paddingRight: '2px'
    },
    '.http-play-icon': {
        color: 'var(--state-success)',
        fontSize: '12px',
        lineHeight: '1',
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: 'center',
        width: '100%'
    },
    '.http-play-icon:hover': {
        opacity: '0.7'
    },
    '.cm-response-format-gutter': {
        width: '30px',
        minWidth: '30px',
        backgroundColor: 'var(--bg-secondary)',
        paddingLeft: '4px',
        paddingRight: '4px'
    },
    '.format-toggle-icon': {
        color: 'var(--text-secondary)',
        fontSize: '12px',
        lineHeight: '1',
        cursor: 'pointer',
        userSelect: 'none',
        display: 'inline-block',
        fontFamily: 'monospace',
        fontWeight: 'bold'
    },
    '.format-toggle-icon:hover': {
        color: 'var(--text-primary)'
    },
    '.http-status-info': {
        color: 'var(--http-status-info)'
    },
    '.http-status-success': {
        color: 'var(--http-status-success)'
    },
    '.http-status-redirect': {
        color: 'var(--http-status-redirect)'
    },
    '.http-status-client-error': {
        color: 'var(--http-status-client-error)'
    },
    '.http-status-server-error': {
        color: 'var(--http-status-server-error)'
    }
});

