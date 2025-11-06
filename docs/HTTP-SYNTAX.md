# HTTP Syntax Highlighting

## Implemented Features

The HTTP language definition supports the following syntax highlighting:

### Section Markers (###)
Lines starting with `###` define sections and are highlighted as **bold keywords**.

```http
### Get Users
### Create User
### Delete User
```

### Comments (#)
Lines starting with a single `#` are **comments** and highlighted in green (light) or muted green (dark).

```http
# This is a comment
# Another comment line
```

### HTTP Verbs
The first non-empty, non-comment line in each section is the request line.
Supported verbs are highlighted as **keywords** (blue in light mode, light blue in dark mode):

- GET
- POST
- PUT
- DELETE
- PATCH
- HEAD
- OPTIONS
- TRACE
- CONNECT

```http
### Example
GET https://api.example.com/users
POST https://api.example.com/users
```

### HTTP Headers
After the request line, lines in the format `Key: Value` are treated as headers.
The key (everything before the colon) is highlighted as a **keyword**.

```http
### Create User
POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123
Accept: application/json
```

### URL
The URL after the HTTP verb is highlighted as **plain text** (no special color).

## Complete Example

```http
### Get All Users
# Retrieves a list of all users from the API
GET https://api.example.com/users
Authorization: Bearer mytoken123
Accept: application/json

### Create New User
# Creates a new user with the provided data
POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer mytoken123

{
  "name": "John Doe",
  "email": "john@example.com"
}

### Get User by ID
GET https://api.example.com/users/123
Authorization: Bearer mytoken123

### Update User
PUT https://api.example.com/users/123
Content-Type: application/json
Authorization: Bearer mytoken123

{
  "name": "Jane Doe"
}

### Delete User
DELETE https://api.example.com/users/123
Authorization: Bearer mytoken123
```

## Color Mapping

| Element | Light Theme | Dark Theme |
|---------|-------------|------------|
| Section markers (###) | Blue, bold | Light blue, bold |
| Comments (#) | Green | Muted green |
| HTTP verbs | Blue | Light blue |
| Header keys | Blue | Light blue |
| URLs | Black | Light gray |
| Plain text | Black | Light gray |

## Implementation

The syntax highlighting uses:
1. **`httpLanguage.ts`** - Stream language parser that tokenizes HTTP files
2. **`httpHighlighting.ts`** - Maps tokens to CSS variables from the theme
3. **`HttpEditor.svelte`** - Applies both to CodeMirror editor

The colors automatically adapt when switching between light and dark themes!

