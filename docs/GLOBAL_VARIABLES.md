# Global Variables

## Overview

Global variables are collection-scoped, in-memory variables that persist for the duration of the application session. They have the **highest precedence** and will override all other variable sources.

## Characteristics

### ✅ Collection-Scoped
- Each collection has its own set of global variables
- Variables are isolated between collections
- Switching collections gives you a fresh set of global variables

### ✅ In-Memory Only
- Not persisted to disk
- Lost when the application closes
- Lost when switching to a different collection

### ✅ Highest Precedence
Global variables override all other variable sources:
```
Global Variables (HIGHEST)
    ↓
Current Section Variables
    ↓
File Preamble Variables
    ↓
Other Section Variables
    ↓
Environment Variables (LOWEST)
```

## Use Cases

### 1. Temporary Authentication Tokens
Set a token from a login response and use it across all requests:
```http
### Login
POST https://api.example.com/auth/login

> {%
// After successful login, set token as global variable
// client.globals.set('authToken', responseToken);  // Future feature
%}

### Use Token in Other Requests
GET https://api.example.com/user/profile
Authorization: Bearer {{authToken}}
```

### 2. Session-Specific IDs
Store IDs created during testing:
```http
### Create User
POST https://api.example.com/users

> {%
// Store the created user ID globally
// client.globals.set('userId', responseUserId);  // Future feature
%}

### Get User
GET https://api.example.com/users/{{userId}}

### Delete User
DELETE https://api.example.com/users/{{userId}}
```

### 3. Testing Overrides
Temporarily override environment or file variables without modifying files:
```http
@baseUrl = https://api.example.com

### Request
GET {{baseUrl}}/data

# If global variable 'baseUrl' is set to 'https://api.dev.example.com',
# it will override the file preamble value
```

## Lifecycle

### Creation
Global variables are created when:
- A post-request script sets them (future feature)
- Manually set via UI (future feature)

### Persistence
- ✅ Persists across file changes within the same collection
- ✅ Persists across request executions
- ❌ Does NOT persist when closing the application
- ❌ Does NOT persist when switching collections

### Destruction
Global variables are cleared when:
- The application is closed
- A different collection is loaded
- Explicitly cleared (future feature)

## Implementation Details

### Store Structure
```typescript
{
  "/path/to/collection1": {
    "token": "abc123",
    "userId": "456"
  },
  "/path/to/collection2": {
    "apiKey": "xyz789"
  }
}
```

### API (Internal)
```typescript
// Get all global variables for a collection
globalVariables.get(collectionPath): Record<string, string>

// Set a variable
globalVariables.set(collectionPath, key, value)

// Delete a variable
globalVariables.delete(collectionPath, key)

// Clear all variables for a collection
globalVariables.clear(collectionPath)

// Clear all variables for all collections
globalVariables.clearAll()
```

## Variable Precedence Example

Environment file:
```json
{
  "dev": {
    "baseUrl": "https://api.dev.com",
    "timeout": "5000"
  }
}
```

HTTP file:
```http
@baseUrl = https://api.staging.com
@userId = 123

### Request
@timeout = 10000
GET {{baseUrl}}/users/{{userId}}
```

With global variables:
```javascript
// Global variables (set via script or UI)
{
  "baseUrl": "https://api.override.com"
}
```

**Result:**
- `baseUrl`: `https://api.override.com` (from **global variables**)
- `timeout`: `10000` (from section preamble)
- `userId`: `123` (from file preamble)

The global variable `baseUrl` overrides both the file and environment values.

## Future Features

### Setting Global Variables (Not Yet Implemented)

#### Via Post-Request Scripts
```http
### Login
POST https://api.example.com/auth/login

> {%
const response = JSON.parse(client.response.body);
client.globals.set('authToken', response.token);
console.log('Token saved globally');
%}
```

#### Via UI
A future UI panel will allow:
- Viewing all global variables for the current collection
- Manually adding/editing/deleting global variables
- Clearing all global variables

### Viewing Global Variables
A UI panel showing:
- Current collection's global variables
- When each was set
- Ability to clear or modify

### Export/Import (Maybe)
Optionally export global variables to a file for sharing or backup:
- Not automatic (prevents accidental token leakage)
- Manual export only when needed
- Could be used for team sharing of test data

## Best Practices

### ✅ DO: Use for Temporary Values
```http
# Store authentication tokens
# Store created resource IDs
# Store session-specific data
```

### ✅ DO: Use for Testing Overrides
```http
# Temporarily override environment values
# Test different configurations
```

### ❌ DON'T: Rely on Persistence
```http
# Don't expect values to survive app restart
# Don't use for permanent configuration
```

### ❌ DON'T: Share Sensitive Data
```http
# Global variables are not encrypted
# They're in memory but could be logged
# Use environment files for sensitive data
```

## Current Limitations

1. **No UI for management** - Variables can only be set programmatically (future feature)
2. **No viewing current values** - No way to see what's currently set (future feature)
3. **No persistence** - Lost on app close or collection switch
4. **No export/import** - Can't save or load global variable sets

## Comparison with Other Variable Types

| Feature | Global | Section | File | Environment |
|---------|--------|---------|------|-------------|
| Precedence | Highest | High | Medium | Lowest |
| Scope | Collection | Single Section | Entire File | Selected Env |
| Persistence | Session | N/A | File | File |
| Editable | Script/UI* | File Edit | File Edit | File Edit |
| Use Case | Runtime | Request-specific | File defaults | Env-specific |

\* UI not yet implemented

## Summary

Global variables provide:
- ✅ Highest precedence (override everything)
- ✅ Collection-scoped isolation
- ✅ Runtime modification capability
- ✅ Perfect for testing and dynamic values
- ❌ No persistence (by design)
- ❌ No UI yet (coming soon)

They're ideal for values that need to be set at runtime (like auth tokens from login responses) and override other variable sources without modifying files.

