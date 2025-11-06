# Post-Script Quick Start Guide

## What are Post-Scripts?

Post-scripts are JavaScript code blocks that execute automatically after an HTTP request completes. They're useful for:
- Logging response data
- Extracting values from responses
- Setting environment variables (coming soon)
- Running assertions/tests (coming soon)

## Basic Syntax

### Inline Script (Script Type)
Use `{% ... %}` syntax for multi-line JavaScript:

```http
### My Request
GET https://api.example.com/data

> {% 
console.log("Request completed!");
const now = new Date();
console.log("Timestamp:", now.toISOString());
%}
```

### Single-Line Script (File Type)
For simple one-liners, just use `>`:

```http
### My Request
GET https://api.example.com/data

> console.log("Done!");
```

## Multiple Post-Scripts

You can have multiple post-scripts per request:

```http
### My Request
GET https://api.example.com/data

> {% console.log("First script"); %}
> {% console.log("Second script"); %}
> console.log("Third script");
```

## What Can Scripts Do?

### Currently Available
- ✅ Standard JavaScript (ES6+)
- ✅ Console logging: `console.log()`
- ✅ Date, Math, and other built-in objects
- ✅ Variables and functions
- ✅ Loops and conditionals

### Example
```http
### Calculate Stats
GET https://api.example.com/numbers

> {%
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
const avg = sum / numbers.length;
console.log("Sum:", sum);
console.log("Average:", avg);
%}
```

## What Scripts CANNOT Do (Yet)

- ❌ Access response data (coming soon)
- ❌ Access request data (coming soon)
- ❌ Set environment variables (coming soon)
- ❌ Make HTTP requests (security limitation)
- ❌ Access file system (security limitation)
- ❌ Use Node.js APIs like `require()` (security limitation)

## Viewing Script Output

Script output appears in the browser console:
1. Open Developer Tools (F12 or Ctrl+Shift+I)
2. Go to Console tab
3. Execute your request
4. See script logs and results

Example output:
```
Post-script results: [{success: true, logs: ["Request completed!", "Timestamp: 2025-11-05T..."]}]
Script 1: Success
  Logs: ["Request completed!", "Timestamp: 2025-11-05T12:34:56.789Z"]
```

## Error Handling

If a script has an error, it will be logged but won't stop other scripts:

```http
### Request with Error
GET https://api.example.com/data

> {% throw new Error("Oops!"); %}
> {% console.log("This still runs"); %}
```

Console output:
```
Script 1: Failed - Error: Oops!
Script 2: Success
  Logs: ["This still runs"]
```

## Tips & Tricks

### 1. Use Comments
```http
> {%
// Calculate response time
const start = Date.now();
console.log("Processing at:", start);
%}
```

### 2. Multi-line String Literals
```http
> {%
const message = `
  Request completed successfully
  Status: OK
  Time: ${Date.now()}
`;
console.log(message);
%}
```

### 3. Debugging
```http
> {%
console.log("=== Debug Info ===");
console.log("Type:", typeof data);
console.log("Value:", JSON.stringify(data, null, 2));
%}
```

## Coming Soon

The next updates will add:
- Access to response: `client.response.body`, `client.response.status`
- Access to request: `client.request.url`, `client.request.method`
- Environment variables: `client.environment.set('token', value)`
- Testing: `client.test()`, `client.expect()`

## Troubleshooting

### Script doesn't execute
- Make sure the request completes successfully
- Check for syntax errors in your script
- Verify the script is after the request body

### Script times out
- Scripts have a 5-second timeout
- Avoid infinite loops: `while(true) {}`
- Keep scripts simple and focused

### Can't access response data
- This feature is coming in the next update
- For now, scripts only have access to JavaScript built-ins

## Example Test File

Try this in a new `.http` file:

```http
### Simple Test
GET https://jsonplaceholder.typicode.com/todos/1

> {% console.log("Todo fetched successfully!"); %}

### Math Test
GET https://jsonplaceholder.typicode.com/users

> {%
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log("Sum of 1-5:", sum);
console.log("Expected: 15");
console.log("Match:", sum === 15 ? "✓" : "✗");
%}

### Date Test
GET https://jsonplaceholder.typicode.com/posts/1

> {%
const now = new Date();
console.log("Year:", now.getFullYear());
console.log("Month:", now.getMonth() + 1);
console.log("Day:", now.getDate());
%}
```

Execute these requests and watch the console for output!

