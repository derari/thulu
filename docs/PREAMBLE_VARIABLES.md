# Preamble Variables Implementation

## Overview
Added support for parsing variables in both file and section preambles. Variables can be used to define reusable values throughout HTTP request files.

## Syntax

Variables are defined using the `@` prefix:
```
@variableName = variableValue
```

Both the variable name and value are trimmed of whitespace.

## Features

### File-level Variables
Variables defined before the first `###` section are available throughout the entire file:

```http
@baseUrl = https://api.example.com
@apiKey = abc123

### Request 1
GET {{baseUrl}}/users
Authorization: {{apiKey}}

### Request 2
GET {{baseUrl}}/posts
Authorization: {{apiKey}}
```

### Section-level Variables
Variables can also be defined in the section preamble (between the `###` marker and the request line):

```http
### Get User
@userId = 123
GET https://api.example.com/users/{{userId}}
```

### Variable Resolution
- Variables use the `{{variableName}}` syntax in requests
- Section variables override file variables with the same name
- Variables can contain special characters: URLs, JSON, etc.
- Multiple `=` signs in values are supported (only first one splits name/value)

## Examples

### Basic Usage
```http
@host = https://api.example.com
@version = v2

### Get Data
GET {{host}}/{{version}}/data
```

### Complex Values
```http
@url = https://api.example.com/path?query=value&other=123
@json = {"key": "value"}
@equation = x = y + z

### Request
GET {{url}}
```

### Mixed File and Section Variables
```http
@baseUrl = https://api.example.com

### Get User
@endpoint = /users/1
GET {{baseUrl}}{{endpoint}}

### Get Posts
@endpoint = /posts
GET {{baseUrl}}{{endpoint}}
```

## Implementation Details

### Interface Changes
Added `variables` property to `Preamble` interface:
```typescript
export interface Preamble {
    startLineNumber: number;
    endLineNumber: number;
    variables?: Record<string, string>;
}
```

### Parser Function
Added `parseVariables()` function that:
1. Iterates through lines in the given range
2. Identifies lines starting with `@`
3. Extracts variable name and value (split on first `=`)
4. Trims both name and value
5. Returns a record of variables

### Integration
- File preamble: Lines before first `###` section
- Section preamble: Lines between `###` and request verb line
- Variables only included when at least one is found (undefined otherwise)

## Test Coverage

Added 11 comprehensive tests covering:
- ✅ Basic variable parsing
- ✅ Trimming names and values
- ✅ Empty values
- ✅ Invalid format (no `=` sign)
- ✅ Multiple variables
- ✅ Section-level variables
- ✅ Mixed file and section variables
- ✅ Undefined when no variables
- ✅ Special characters in values
- ✅ Multiple `=` in value
- ✅ Whitespace handling

## Files Modified

1. **`renderer/src/lib/collection.ts`**
   - Added `variables?: Record<string, string>` to `Preamble` interface

2. **`renderer/src/lib/editor/httpParser.ts`**
   - Added `parseVariables()` function
   - Updated file preamble parsing
   - Updated section preamble parsing

3. **`renderer/src/lib/editor/httpParser.test.ts`**
   - Added 11 test cases for variable parsing

4. **`collections/Test1/variables-example.http`**
   - Created example file demonstrating variable usage

## Notes

- Variables are **parsed** but not yet **substituted** in requests
- Variable substitution will be handled by the request executor
- This provides the foundation for environment-agnostic variable definitions
- Variables in preambles complement environment-specific variables from env files

## Next Steps

1. Implement variable substitution in request executor
2. Add variable precedence rules (section > file > environment)
3. Create UI to view available variables
4. Add variable autocomplete in editor
5. Consider variable validation/type checking

