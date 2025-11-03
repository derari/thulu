# HTTP Editor with CodeMirror 6

## Installation

CodeMirror 6 is installed in the **renderer** (Svelte) part of the app:

```bash
cd renderer
npm install codemirror @codemirror/state @codemirror/view @codemirror/commands @codemirror/language @codemirror/autocomplete
```

## Why in Renderer?

- CodeMirror is a **UI library** that manipulates the DOM
- It needs to run in the browser/renderer process, not Node.js
- Svelte components live in the renderer process
- The main Electron process doesn't have access to the DOM

## Architecture

```
Main Process (Node.js)          Renderer Process (Browser/Svelte)
├── File system access          ├── CodeMirror editor
├── Read/write .http files      ├── Syntax highlighting
└── IPC handlers                ├── UI elements (buttons, widgets)
                                └── User interactions
```

## Basic Editor Component

`HttpEditor.svelte` - A basic CodeMirror editor with:
- ✅ Line numbers
- ✅ Basic keyboard shortcuts
- ✅ Two-way content binding
- ✅ Proper lifecycle management (mount/unmount)

## Next Steps

### 1. Custom HTTP Syntax Highlighting

Create a custom language definition for HTTP files:

```typescript
import { LanguageSupport, StreamLanguage } from '@codemirror/language';

const httpLanguage = StreamLanguage.define({
  token(stream, state) {
    // Highlight ### as section markers
    if (stream.match(/^###/)) {
      return 'heading';
    }
    // Highlight HTTP verbs
    if (stream.match(/^(GET|POST|PUT|DELETE|PATCH)/)) {
      return 'keyword';
    }
    // Highlight headers
    if (stream.match(/^[A-Za-z-]+:/)) {
      return 'propertyName';
    }
    stream.next();
    return null;
  }
});
```

### 2. Autocomplete

Add autocomplete for HTTP verbs, headers, and variables:

```typescript
import { autocompletion } from '@codemirror/autocomplete';

const httpCompletions = autocompletion({
  override: [
    (context) => {
      const word = context.matchBefore(/\w*/);
      if (!word) return null;
      
      return {
        from: word.from,
        options: [
          { label: 'GET', type: 'keyword' },
          { label: 'POST', type: 'keyword' },
          { label: 'Content-Type', type: 'property' },
          // Add more completions
        ]
      };
    }
  ]
});
```

### 3. Embedded Widgets

Add buttons and UI elements inline:

```typescript
import { Decoration, WidgetType } from '@codemirror/view';

class RunButtonWidget extends WidgetType {
  toDOM() {
    const button = document.createElement('button');
    button.textContent = '▶ Run';
    button.className = 'cm-run-button';
    button.onclick = () => {
      // Execute HTTP request
    };
    return button;
  }
}

// Add widget after each ### section marker
```

### 4. Gutter Decorations

Add icons in the gutter:

```typescript
import { gutter, GutterMarker } from '@codemirror/view';

class SectionMarker extends GutterMarker {
  toDOM() {
    const icon = document.createElement('span');
    icon.textContent = '🌐';
    return icon;
  }
}
```

## Usage Example

```svelte
<script>
  import HttpEditor from '$lib/HttpEditor.svelte';
  
  let content = '### Get Users\nGET https://api.example.com/users';
  
  async function loadFile(filePath) {
    content = await window.electronAPI.readHttpFile(filePath);
  }
</script>

<HttpEditor bind:content {filePath} />
```

## Benefits of CodeMirror 6

1. **Modular** - Only include features you need
2. **TypeScript** - Full type safety
3. **Performance** - Virtual rendering for large files
4. **Extensible** - Custom languages, themes, widgets
5. **Accessible** - Keyboard navigation, screen readers
6. **Small Bundle** - ~500KB vs Monaco's ~3MB
7. **Svelte-friendly** - Works naturally with Svelte's reactivity

## Resources

- [CodeMirror 6 Documentation](https://codemirror.net/docs/)
- [Language Package Guide](https://codemirror.net/examples/lang-package/)
- [Decorations Example](https://codemirror.net/examples/decoration/)
- [Autocomplete Guide](https://codemirror.net/docs/ref/#autocomplete)

