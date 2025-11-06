# HTTP Body Highlighting - Architecture

## Overview

Body highlighting uses a simple, modular architecture with regex-based content-type matching and separate highlighting files for each language.

## File Structure

```
renderer/src/lib/
├── httpLanguage.ts              # Main HTTP parser
├── contentTypeMapping.ts        # Content-Type → Highlighter mapping
└── languages/
    ├── jsonHighlighting.ts      # JSON body highlighting
    ├── xmlHighlighting.ts       # XML body highlighting
    ├── htmlHighlighting.ts      # HTML body highlighting
    └── plainHighlighting.ts     # Plain text (default)
```

## Content-Type Mapping

All mappings are defined in `contentTypeMapping.ts`:

```typescript
export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
    // Specific types first
    { pattern: /^application\/json$/i, key: 'json', highlighter: highlightJsonToken },
    { pattern: /^text\/json$/i, key: 'json', highlighter: highlightJsonToken },
    
    // General patterns last (more permissive)
    { pattern: /\bjson\b/i, key: 'json', highlighter: highlightJsonToken }
];
```

**Testing Order**: Patterns are tested in array order, so place:
1. Specific exact matches first (e.g., `/^application\/json$/`)
2. More general patterns last (e.g., `/\bjson\b/`)

This ensures `application/json+custom` falls back to the general JSON pattern.

## Adding a New Language

### 1. Create Highlighting File

Create `languages/yamlHighlighting.ts`:

```typescript
export function highlightYamlToken(stream: any): string | null {
    // YAML key-value pairs
    if (stream.match(/^[a-zA-Z_][\w]*:/)) {
        return 'keyword';
    }
    
    // YAML strings
    if (stream.match(/"[^"]*"|'[^']*'/)) {
        return 'string';
    }
    
    return null;
}
```

### 2. Add to Content-Type Mapping

In `contentTypeMapping.ts`:

```typescript
import { highlightYamlToken } from './languages/yamlHighlighting.js';

export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
    // ...existing mappings...
    
    // Add YAML (specific first)
    { pattern: /^application\/yaml$/i, key: 'yaml', highlighter: highlightYamlToken },
    { pattern: /^text\/yaml$/i, key: 'yaml', highlighter: highlightYamlToken },
    { pattern: /\byaml\b/i, key: 'yaml', highlighter: highlightYamlToken }
];
```

That's it! The highlighter will automatically be used for any `Content-Type` matching your patterns.

## Language Highlighting Files

Each language file exports a single function:

```typescript
export function highlightXxxToken(stream: any): string | null
```

**Returns:**
- Token type string (`'string'`, `'number'`, `'keyword'`, etc.) if matched
- `null` if no match (parser will try next pattern or default to string)

**Available Token Types:**
- `'string'` → `var(--code-string)`
- `'number'` → `var(--code-literal)`
- `'atom'` → `var(--code-literal)` (for true/false/null)
- `'keyword'` → `var(--code-keyword)`
- `'comment'` → `var(--code-comment)`
- `'punctuation'` → `var(--code-plain)`

## Pattern Matching Examples

```typescript
// Exact match
{ pattern: /^application\/json$/, ... }  // Only "application/json"

// With parameters
{ pattern: /^application\/json/, ... }   // "application/json; charset=utf-8"

// Case insensitive
{ pattern: /^text\/json$/i, ... }        // "text/json" or "TEXT/JSON"

// Contains keyword
{ pattern: /\bjson\b/i, ... }            // "application/vnd.api+json"

// Multiple keywords
{ pattern: /\b(yaml|yml)\b/i, ... }      // "text/yaml" or "text/yml"
```

## How It Works

1. **Header Parsing**: When `Content-Type` header is found, value is stored in parser state
2. **Body Start**: Empty line after headers triggers `getHighlighterForContentType(contentType)`
3. **Pattern Testing**: Content-Type is tested against patterns in order until match found
4. **Highlighter Assignment**: Matching highlighter function is stored in state
5. **Token Processing**: For each line in body, highlighter function is called with stream
6. **Fallback**: If no token matched, line is marked as `'string'` (default body color)

## Current Supported Types

| Content-Type Pattern | Language | File |
|---------------------|----------|------|
| `application/json`, `text/json`, `*json*` | JSON | `jsonHighlighting.ts` |
| `application/xml`, `text/xml`, `*xml*` | XML | `xmlHighlighting.ts` |
| `text/html`, `application/xhtml+xml`, `*html*` | HTML | `htmlHighlighting.ts` |
| (any other) | Plain | `plainHighlighting.ts` |

## Benefits

✅ **Simple** - Basic regex patterns, no complex parsers
✅ **Modular** - Each language in separate file
✅ **Extensible** - Add new languages easily
✅ **Ordered** - Specific patterns before general ones
✅ **Maintainable** - Single mapping file to configure everything

