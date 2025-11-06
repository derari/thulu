# response.body - Accessing Response Data

## Overview

Post-scripts can now access the HTTP response body via `response.body`. The body is automatically parsed as JSON when the response content type indicates JSON, making it easy to extract values from API responses.

## Automatic JSON Parsing

The response body is automatically parsed as a JavaScript object when the `Content-Type` header indicates JSON:

**JSON Content Types:**
- `application/json`
- `application/json; charset=utf-8`
- `application/vnd.api+json`
- Any content type containing `+json`

For all other content types, the body is returned as a plain string.

## Basic Usage

### Accessing JSON Properties

```http
### Get User
GET https://api.example.com/users/123

> {%
console.log("Name:", response.body.name);
console.log("Email:", response.body.email);
console.log("Status:", response.body.status);
%}
```

### Storing Values as Global Variables

```http
### Login
POST https://api.example.com/auth/login
Content-Type: application/json

{"email": "user@example.com", "password": "secret"}

> {%
const token = response.body.token;
const userId = response.body.user.id;

client.global.set("authToken", token);
client.global.set("userId", String(userId));

console.log("Logged in as:", userId);
%}
```

## Working with Different Response Types

### JSON Object

```http
GET https://api.example.com/user/profile

Response:
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com"
}

> {%
console.log(typeof response.body); // "object"
console.log(response.body.name);    // "John Doe"
console.log(response.body.email);   // "john@example.com"
%}
```

### JSON Array

```http
GET https://api.example.com/users

Response:
[
  {"id": 1, "name": "John"},
  {"id": 2, "name": "Jane"}
]

> {%
console.log(Array.isArray(response.body));  // true
console.log("Total users:", response.body.length);  // 2
console.log("First user:", response.body[0].name);  // "John"

// Loop through array
response.body.forEach(user => {
  console.log("User:", user.name);
});
%}
```

### Nested JSON

```http
GET https://api.example.com/order/456

Response:
{
  "orderId": "456",
  "customer": {
    "id": 123,
    "name": "John Doe",
    "address": {
      "city": "New York",
      "country": "USA"
    }
  },
  "items": [
    {"product": "Laptop", "price": 999},
    {"product": "Mouse", "price": 29}
  ]
}

> {%
// Access nested properties
console.log("Customer:", response.body.customer.name);
console.log("City:", response.body.customer.address.city);
console.log("First item:", response.body.items[0].product);

// Store nested values
client.global.set("customerId", String(response.body.customer.id));
client.global.set("orderCity", response.body.customer.address.city);
%}
```

### Plain Text Response

```http
GET https://api.example.com/status

Response:
OK

> {%
console.log(typeof response.body);  // "string"
console.log(response.body);         // "OK"
%}
```

### Invalid JSON Fallback

```http
GET https://api.example.com/data
Content-Type: application/json

Response:
{invalid json}

> {%
// JSON parsing fails, falls back to string
console.log(typeof response.body);  // "string"
console.log(response.body);         // "{invalid json}"
%}
```

## Common Patterns

### 1. Extract Authentication Token

```http
### Login
POST https://api.example.com/auth/login
Content-Type: application/json

{"email": "user@example.com", "password": "secret"}

> {%
if (response.body.token) {
  client.global.set("authToken", response.body.token);
  console.log("Token saved:", response.body.token);
} else {
  console.log("Login failed: No token in response");
}
%}

### Use Token
GET https://api.example.com/profile
Authorization: Bearer {{authToken}}
```

### 2. Resource Creation Chain

```http
### Create Project
POST https://api.example.com/projects
Content-Type: application/json

{"name": "New Project"}

> {%
const projectId = String(response.body.id);
client.global.set("projectId", projectId);
console.log("Created project:", projectId);
%}

### Add Task to Project
POST https://api.example.com/projects/{{projectId}}/tasks
Content-Type: application/json

{"title": "First Task"}

> {%
const taskId = String(response.body.id);
client.global.set("taskId", taskId);
console.log("Created task:", taskId);
%}

### Update Task
PUT https://api.example.com/tasks/{{taskId}}
Content-Type: application/json

{"status": "completed"}
```

### 3. Extract Multiple Values

```http
### Get User Details
GET https://api.example.com/users/123

> {%
const user = response.body;

// Extract multiple values
client.global.set("userId", String(user.id));
client.global.set("userName", user.name);
client.global.set("userEmail", user.email);
client.global.set("userRole", user.role);

console.log("User data stored:", {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});
%}
```

### 4. Conditional Logic Based on Response

```http
### Check API Status
GET https://api.example.com/health

> {%
const status = response.body.status;

if (status === "healthy") {
  client.global.set("apiStatus", "available");
  console.log("API is healthy");
} else {
  client.global.set("apiStatus", "unavailable");
  console.log("API is down:", response.body.message);
}
%}
```

### 5. Array Processing

```http
### Get All Users
GET https://api.example.com/users

> {%
const users = response.body;

// Find specific user
const admin = users.find(u => u.role === "admin");
if (admin) {
  client.global.set("adminId", String(admin.id));
  console.log("Admin user:", admin.name);
}

// Count by role
const adminCount = users.filter(u => u.role === "admin").length;
console.log("Total admins:", adminCount);

// Get all IDs
const userIds = users.map(u => u.id).join(",");
console.log("All user IDs:", userIds);
%}
```

### 6. Validation

```http
### Create Resource
POST https://api.example.com/resources
Content-Type: application/json

{"name": "Test Resource"}

> {%
const response = response.body;

// Validate response
if (response.id && response.name) {
  client.global.set("resourceId", String(response.id));
  console.log("Resource created successfully:", response.id);
} else {
  console.log("Unexpected response format:", response);
}
%}
```

## Type Checking

Since JSON parsing is automatic, you can check the type:

```javascript
// Check if parsed as object (JSON)
if (typeof response.body === 'object') {
  console.log("JSON response");
  console.log("Name:", response.body.name);
}

// Check if string (plain text)
if (typeof response.body === 'string') {
  console.log("Plain text response:", response.body);
}

// Check if array
if (Array.isArray(response.body)) {
  console.log("Array response with", response.body.length, "items");
}
```

## Edge Cases

### Empty Response Body

```javascript
console.log(response.body);  // "" (empty string)
console.log(typeof response.body);  // "string"
```

### Undefined Response Body

```javascript
console.log(response.body);  // undefined
```

### Null Response

```javascript
// JSON response: null
console.log(response.body);  // null
console.log(typeof response.body);  // "object"
```

## Important Notes

### ✅ DO:

**Type Conversion When Setting Global Variables**
```javascript
// Global variables only accept strings
client.global.set("userId", String(response.body.id));
client.global.set("count", String(response.body.count));
```

**Safe Property Access**
```javascript
// Check if property exists
if (response.body.token) {
  client.global.set("token", response.body.token);
}

// Use optional chaining (if available)
const city = response.body?.address?.city;
if (city) {
  client.global.set("userCity", city);
}
```

**Error Handling**
```javascript
try {
  const token = response.body.token;
  client.global.set("authToken", token);
} catch (error) {
  console.log("Failed to extract token:", error);
}
```

### ❌ DON'T:

**Don't Assume JSON**
```javascript
// Bad: Assumes JSON without checking
client.global.set("name", response.body.name);

// Good: Check type first
if (typeof response.body === 'object' && response.body.name) {
  client.global.set("name", response.body.name);
}
```

**Don't Forget Type Conversion**
```javascript
// Bad: Numbers need to be converted to strings
client.global.set("userId", response.body.id);  // Error!

// Good: Convert to string
client.global.set("userId", String(response.body.id));
```

## Limitations

1. **Read-Only**: You can only read the response body, not modify it
2. **No Response Metadata (Yet)**: Status code, headers not yet available via `response.*`
3. **String-Only Global Variables**: Must convert numbers/booleans to strings when storing

## Future Enhancements

Coming soon:
- `response.status` - HTTP status code
- `response.statusText` - HTTP status text
- `response.headers` - Response headers object
- `response.json()` - Explicit JSON parsing method
- `client.request.*` - Access request data

## Summary

✅ Access response body: `response.body`
✅ Automatic JSON parsing based on Content-Type
✅ Works with objects, arrays, strings
✅ Extract values and store as global variables
✅ Type-safe with fallback to string
✅ Perfect for auth flows and data extraction

Use `response.body` to build powerful request chains and dynamic workflows!

