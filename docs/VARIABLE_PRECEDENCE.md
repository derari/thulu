# Variable Precedence in Request Execution

## Overview

When executing an HTTP request, variables are merged from multiple sources with a specific precedence order. This allows for flexible variable management at different scopes.

## Variable Sources (in order of precedence)

### 1. Global Variables (Highest Priority)
In-memory variables that persist for the current collection session. Set via post-request scripts or UI (future feature).
```http
# If a global variable is set (e.g., via script):
# globalVariables = { baseUrl: "https://global.example.com" }

### My Request
GET {{baseUrl}}/data  # Uses global value
```

**Key Points:**
- ✅ Overrides ALL other variable sources
- ✅ Collection-scoped (each collection has its own globals)
- ❌ Not persisted (lost on app close or collection switch)

### 2. Current Section Variables
Variables defined in the preamble of the section being executed:
```http
### My Request
@userId = 123
@endpoint = /users
GET {{baseUrl}}{{endpoint}}/{{userId}}
```

### 3. File Preamble Variables
Variables defined at the top of the file (before any `###` sections):
```http
@baseUrl = https://api.example.com
@apiKey = secret123

### Request
GET {{baseUrl}}/data
```

### 4. Other Section Variables
Variables from other sections in the file. **Important**: Other sections can only ADD variables if they're not already defined. They cannot override existing values.

```http
### Section 1
@timeout = 5000
GET https://api.example.com

### Section 2
@timeout = 10000  # This won't affect Section 3
@retries = 3      # This WILL be available to Section 3
GET https://api.example.com

### Section 3
# timeout = 5000 (from Section 1, first to define it)
# retries = 3 (from Section 2, only one to define it)
GET https://api.example.com
```

### 5. Environment Variables (Lowest Priority)
Variables loaded from the selected environment file (e.g., `http-client.env.json`).

## Precedence Rules

The merging algorithm works as follows:

1. **Start with environment variables** as the base
2. **Add variables from other sections** (only if key doesn't exist yet)
   - Order matters: first section to define a variable wins among other sections
3. **Override with file preamble variables** (always overrides environment and other sections)
4. **Override with current section variables** (overrides environment, other sections, and file)
5. **Override with global variables** (always wins, highest priority)

## Examples

### Example 1: Basic Override

```http
@baseUrl = https://api.example.com

### Request 1
@baseUrl = https://api.dev.example.com
GET {{baseUrl}}/users
# Uses: https://api.dev.example.com/users
```

### Example 2: Mixed Sources

Environment file (`http-client.env.json`):
```json
{
  "production": {
    "baseUrl": "https://api.prod.com",
    "apiKey": "prod-key",
    "timeout": "30000"
  }
}
```

HTTP file:
```http
@baseUrl = https://api.staging.com
@userId = 123

### Section 1
@endpoint = /users
GET {{baseUrl}}{{endpoint}}/{{userId}}
# Uses:
# - baseUrl: https://api.staging.com (file preamble overrides env)
# - endpoint: /users (section)
# - userId: 123 (file preamble)
# - apiKey: prod-key (from environment)
# - timeout: 30000 (from environment)

### Section 2
@baseUrl = https://api.dev.com
@endpoint = /posts
GET {{baseUrl}}{{endpoint}}
# Uses:
# - baseUrl: https://api.dev.com (section overrides file and env)
# - endpoint: /posts (section)
# - userId: 123 (inherited from file preamble)
# - apiKey: prod-key (from environment)
# - timeout: 30000 (from environment)
```

### Example 3: Other Sections Don't Override

```http
@sharedVar = file-value

### Section 1
@varFromSection1 = value1
@sharedSectionVar = section1-value
GET https://api.example.com

### Section 2
@varFromSection2 = value2
@sharedSectionVar = section2-value  # Won't override Section 1's value for Section 3
GET https://api.example.com

### Section 3
# Available variables:
# - sharedVar: file-value (from file preamble)
# - varFromSection1: value1 (from Section 1)
# - varFromSection2: value2 (from Section 2)
# - sharedSectionVar: section1-value (Section 1 defined it first)
GET https://api.example.com
```

### Example 4: Section Overrides Everything

```http
@version = v1
@apiKey = file-key

### Section 1
@apiKey = section1-key
GET https://api.example.com
# apiKey = section1-key (section wins)

### Section 2
@version = v2
GET https://api.example.com
# version = v2 (section wins)
# apiKey = file-key (from file, Section 1's value doesn't carry over)
```

## Implementation Details

The `mergeVariablesFromFile()` function in `httpRequestExecutor.ts` implements this logic:

1. Copy environment variables as base
2. Loop through all OTHER sections, adding their variables only if not already defined
3. Apply file preamble variables (overwriting any conflicts)
4. Apply current section variables (overwriting any conflicts)

## Best Practices

### 1. Use File Preamble for Shared Defaults
```http
@baseUrl = https://api.example.com
@contentType = application/json

### Request 1
POST {{baseUrl}}/users
Content-Type: {{contentType}}

### Request 2
POST {{baseUrl}}/posts
Content-Type: {{contentType}}
```

### 2. Use Section Variables for Request-Specific Values
```http
@baseUrl = https://api.example.com

### Get User
@userId = 123
GET {{baseUrl}}/users/{{userId}}

### Get Post
@postId = 456
GET {{baseUrl}}/posts/{{postId}}
```

### 3. Use Environments for Deployment-Specific Values
Keep sensitive or environment-specific values in environment files:
- API keys
- Base URLs for different environments (dev, staging, prod)
- Timeouts and retry counts

### 4. Don't Rely on Other Section Variables
Since other sections can only ADD variables (not override), don't depend on their values. Use file preamble or current section for important variables.

## Common Pitfalls

### ❌ Expecting Other Section to Override
```http
### Section 1
@timeout = 5000
GET https://api.example.com

### Section 2
@timeout = 10000  # Won't affect Section 3!
GET https://api.example.com

### Section 3
GET https://api.example.com
# timeout is 5000, not 10000
```

### ✅ Use File Preamble or Section Variable
```http
@timeout = 5000

### Section 1
GET https://api.example.com

### Section 2
@timeout = 10000  # Overrides file preamble for this section only
GET https://api.example.com
```

## Summary

The precedence order (highest to lowest):
1. **Global Variables** (always wins - runtime overrides)
2. **Current Section** (overrides file, other sections, environment)
3. **File Preamble** (overrides environment and other sections)
4. **Other Sections** (can only add new variables)
5. **Environment** (base defaults)

This design ensures that:
- Runtime global variables can override everything
- Section-specific overrides always work
- File-wide defaults are easy to set
- Other sections don't accidentally interfere with each other
- Environment variables provide sensible defaults

See also: [Global Variables Documentation](GLOBAL_VARIABLES.md)

