# HTTP Body Highlighting

## Overview

The HTTP language parser now supports content-type-aware body highlighting. After headers, an empty line marks the start of the request body, which is highlighted based on the `Content-Type` header.

## Supported Content Types

### JSON (`application/json`, `text/json`)
- **Strings** (`"..."`) → String color (red/orange)
- **Numbers** (`123`, `3.14`, `-5`, `1e10`) → Literal color (teal/light teal)
- **Booleans** (`true`, `false`) → Literal color
- **Null** (`null`) → Literal color
- **Structural** (`{}[],:`) → Plain color

### XML/HTML (`application/xml`, `text/xml`, `text/html`)
- **Tags** (`<tag>`, `</tag>`) → Keyword color (blue/light blue)
- **Content** → String color

### Plain Text (default for unknown types)
- All body content → String color

## Content-Type Mapping

Defined in `httpLanguage.ts`:

```typescript
export const CONTENT_TYPE_LANGUAGES: Record<string, () => any> = {
    'application/json': json,
    'text/json': json,
    'application/xml': xml,
    'text/xml': xml,
    'application/xhtml+xml': html,
    'text/html': html
};
```

To add support for new content types, add entries to this mapping object.

## Example

```http
### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "age": 30,
  "active": true,
  "email": null
}
```

**Highlighting:**
- `{`, `}`, `:`, `,` → Plain color (black/light gray)
- `"name"`, `"age"`, `"active"`, `"email"` → String color (red/orange)
- `"John Doe"` → String color
- `30` → Literal color (teal/light teal)
- `true`, `null` → Literal color

## How It Works

1. **Header Parsing**: When parsing headers, the `Content-Type` header value is captured and stored in parser state
2. **Body Detection**: After headers, an empty line transitions parser into body mode
3. **Content-Type Detection**: Body highlighting rules are applied based on the stored content type
4. **Token Assignment**: Body content is tokenized according to the detected language
5. **Theme Application**: Tokens use CSS variables from the theme system

## Body Boundaries

- **Start**: First line after the empty line following headers
- **End**: Next `###` section marker or end of document
- **Trailing Empty Lines**: Ignored (not highlighted)

## Comment Handling

The `#` symbol does NOT indicate comments inside the body - it's treated as regular content. Comments are only recognized outside of request bodies.

## Theme Colors Used

| Token Type | CSS Variable | Light Mode | Dark Mode |
|------------|--------------|------------|-----------|
| Strings | --code-string | #a31515 | #ce9178 |
| Numbers/Booleans | --code-literal | #098658 | #b5cea8 |
| Keywords (tags) | --code-keyword | #0000ff | #569cd6 |
| Plain text | --code-plain | #1a1a1a | #d4d4d4 |
| Punctuation | --code-plain | #1a1a1a | #d4d4d4 |

All colors automatically adapt when switching between light and dark themes.

