# Setting Global Variables from Post-Scripts

## Overview

Post-scripts can now set global variables using the `client.global.set(key, value)` API. This allows scripts to extract data from responses and store it for use in subsequent requests.

## Syntax

```javascript
client.global.set(key, value)
```

**Parameters:**
- `key` (string): The variable name
- `value` (string): The variable value

**Returns:** Nothing

## Example Usage

### 1. Basic Usage - Store Authentication Token

```http
### Login
POST https://api.example.com/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "secret"
}

> {%
// Extract token from response and store globally
const token = "bearer-token-12345"; // In reality, parse from response
client.global.set("authToken", token);
console.log("Token stored:", token);
%}
```

### 2. Use Stored Variable in Next Request

```http
### Get User Profile
GET https://api.example.com/user/profile
Authorization: Bearer {{authToken}}
```

The `{{authToken}}` will be replaced with the value set by the previous script.

### 3. Store Multiple Variables

```http
### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

> {%
// Store multiple related values
client.global.set("userId", "12345");
client.global.set("userEmail", "john@example.com");
client.global.set("createdAt", new Date().toISOString());
console.log("User data stored globally");
%}
```

### 4. Resource Creation Chain

```http
### 1. Create Project
POST https://api.example.com/projects
Content-Type: application/json

{"name": "New Project"}

> {%
const projectId = "proj-123"; // Parse from response
client.global.set("projectId", projectId);
%}

### 2. Create Task in Project
POST https://api.example.com/projects/{{projectId}}/tasks
Content-Type: application/json

{"title": "First Task"}

> {%
const taskId = "task-456"; // Parse from response
client.global.set("taskId", taskId);
%}

### 3. Add Comment to Task
POST https://api.example.com/tasks/{{taskId}}/comments
Content-Type: application/json

{"text": "Great work!"}
```

### 5. Override File/Environment Variables

```http
@baseUrl = https://api.staging.com

### Switch to Production Dynamically
GET https://api.example.com/config

> {%
// Override the file variable for subsequent requests
client.global.set("baseUrl", "https://api.production.com");
console.log("Switched to production URL");
%}

### This Uses Production URL
GET {{baseUrl}}/users
# Uses https://api.production.com/users (from global)
# Not https://api.staging.com/users (from file)
```

## How It Works

### Execution Flow

1. **HTTP Request Executes**
   - Request is sent with current variables (env + file + section + global)

2. **Post-Script Runs**
   - Script has access to `client.global.set()`
   - Each call to `set()` is tracked

3. **Changes Applied**
   - After script completes successfully, all `set()` calls are applied
   - Global variables store is updated immediately
   - Changes are visible in EnvironmentsView

4. **Next Request Uses New Values**
   - Global variables have highest precedence
   - They override file, section, and environment variables

### Variable Precedence (Reminder)

```
1. Global Variables (HIGHEST) ← Set via client.global.set()
2. Current Section Variables
3. File Preamble Variables
4. Other Section Variables
5. Environment Variables (LOWEST)
```

## Important Notes

### ✅ DO:

**Store Dynamic Data**
```javascript
client.global.set("token", responseToken);
client.global.set("userId", responseUserId);
```

**Chain Requests**
```javascript
client.global.set("orderId", order.id);
// Next request uses {{orderId}}
```

**Override Configuration**
```javascript
// Temporarily switch environments
client.global.set("baseUrl", "https://api.test.com");
```

### ❌ DON'T:

**Store Sensitive Data Permanently**
```javascript
// Global variables are not persisted
// They're lost when app closes
client.global.set("apiKey", "secret"); // OK for session, but won't persist
```

**Expect Variables Between Collections**
```javascript
// Global variables are collection-scoped
// Switching collections clears them
```

## API Reference

### `client.global.set(key, value)`

Sets a global variable for the current collection.

**Parameters:**
- `key` (string): Variable name
  - Must be a valid string
  - Can contain any characters (no restrictions)
- `value` (string): Variable value
  - Must be a string
  - Can be empty string (`""`)

**Behavior:**
- Overwrites existing value if key already exists
- Creates new variable if key doesn't exist
- Changes apply immediately after script completes
- Only works if collection path is available

**Example:**
```javascript
client.global.set("token", "abc123");
client.global.set("userId", "456");
client.global.set("empty", ""); // Empty string is valid
```

### Error Handling

If no collection path is provided (shouldn't happen in normal use):
```javascript
client.global.set("key", "value");
// Logs: "Warning: Cannot set global variable - no collection path provided"
// Variable is NOT set
```

## Viewing Global Variables

After setting global variables via script:

1. Open the **Environments View** (right panel)
2. Scroll to bottom to see **Global Variables** section
3. View all global variables for current collection
4. Click delete button to remove any variable

## Console Logging

Track what's happening:

```javascript
console.log("Before setting token");
client.global.set("authToken", token);
console.log("Token set:", token);
```

Output appears in browser console (F12):
```
Script 1: Success
  Logs: ["Before setting token", "Token set: abc123"]
  Global variable changes: {authToken: "abc123"}
```

## Real-World Example: Full Authentication Flow

```http
@baseUrl = https://api.example.com

### 1. Login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

> {%
// Store auth token and user ID
const token = "jwt-token-12345"; // Parse from actual response
const userId = "user-789"; // Parse from actual response

client.global.set("authToken", token);
client.global.set("currentUserId", userId);

console.log("Logged in:", userId);
console.log("Token:", token);
%}

### 2. Get User Profile
GET {{baseUrl}}/users/{{currentUserId}}
Authorization: Bearer {{authToken}}

> {%
console.log("Profile retrieved for user:", "{{currentUserId}}");
%}

### 3. Update Profile
PUT {{baseUrl}}/users/{{currentUserId}}
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "name": "Updated Name"
}

> {%
console.log("Profile updated");
%}

### 4. Logout
POST {{baseUrl}}/auth/logout
Authorization: Bearer {{authToken}}

> {%
// Clear the token after logout
client.global.set("authToken", "");
console.log("Logged out, token cleared");
%}
```

## Limitations

1. **String Values Only**
   - Only string values are supported
   - Convert other types to strings: `String(value)` or `value.toString()`

2. **No Getter Method (Yet)**
   - Can't read global variables in scripts: `client.global.get(key)` ❌
   - Can only set them
   - Future enhancement

3. **Not Persisted**
   - Global variables are in-memory only
   - Lost when app closes or collection switches
   - By design for security

4. **Collection-Scoped**
   - Each collection has isolated global variables
   - Can't share between collections

## Future Enhancements

Coming soon:
- `client.global.get(key)` - Read global variables in scripts
- `client.global.delete(key)` - Delete specific variable
- `client.global.clear()` - Clear all global variables
- `client.response` - Access response data (status, headers, body)
- `client.request` - Access request data

## Summary

✅ Set global variables: `client.global.set(key, value)`
✅ Use in requests: `{{variableName}}`
✅ Highest precedence (overrides everything)
✅ Perfect for auth tokens, IDs, dynamic data
✅ Visible in EnvironmentsView
✅ Collection-scoped and session-only

Start using `client.global.set()` in your post-scripts to create powerful request workflows!

