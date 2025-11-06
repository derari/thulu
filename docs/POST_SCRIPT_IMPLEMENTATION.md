# Post-Script Execution Implementation

## Overview
Post-scripts are now executed after HTTP requests complete. Scripts run in a secure sandboxed environment in the Electron main process using Node.js's `vm` module.

## Architecture

### 1. **Main Process (src/scriptExecutor.ts)**
- `executeScript()` function runs JavaScript code in an isolated VM context
- Uses `vm.createContext()` to create a sandbox with no access to Node.js APIs
- Timeout protection (default 5 seconds) prevents infinite loops
- Only provides `console.log()` for output

**Security features:**
- No access to `require()`, `import`, `process`, `__dirname`, `__filename`
- No access to filesystem, network, or any Node.js APIs
- Executes in isolated context with explicit timeout
- Catches and reports both syntax and runtime errors

### 2. **IPC Communication**
- Renderer process sends script code to main process via `script:execute` channel
- Main process executes and returns results
- Added to `preload.ts` as `window.electronAPI.executeScript()`

### 3. **HTTP Request Executor (renderer/src/lib/editor/httpRequestExecutor.ts)**
- Extracts post-script code based on type:
  - **Script type** (`> {% code %}`): Extracts content between `{%` and `%}`
  - **File type** (`> text`): Uses text after `>` as code
- Executes all post-scripts sequentially after HTTP response
- Returns script results with success status, errors, and logs

### 4. **Response Handling (HttpEditor.svelte)**
- Logs script execution results to browser console
- Shows success/failure status for each script
- Displays any logs or errors

## Example Usage

```http
### Simple Script
GET https://api.example.com/data

> {% console.log("Request completed!"); %}

### Multi-line Script
POST https://api.example.com/users
Content-Type: application/json

{"name": "John"}

> {%
const timestamp = Date.now();
console.log("User created at:", timestamp);
console.log("Status: Success");
%}

### Multiple Scripts
GET https://api.example.com/todos

> {% console.log("First script"); %}
> {% console.log("Second script"); %}
```

## Testing

Test file created: `src/scriptExecutor.test.ts`

Tests cover:
- ✅ Basic script execution
- ✅ Console.log output capture
- ✅ Arithmetic operations
- ✅ Syntax error handling
- ✅ Runtime error handling
- ✅ Timeout on infinite loops
- ✅ Security: No access to require/process/__dirname

## Current Limitations

Currently scripts only have access to:
- Standard JavaScript (ES6+)
- `console.log()` for output
- Basic JavaScript objects (Date, Math, etc.)

**Not yet available:**
- Response data (status, headers, body)
- Request data
- Environment variable manipulation
- Assertions/testing
- File system access

## Next Steps

1. **Inject Response Data**: Add `client.response` object with HTTP response details
2. **Inject Request Data**: Add `client.request` object with request details
3. **Environment Variables**: Add `client.environment.set()` and `.get()` methods
4. **Error Display**: Show script errors in UI (not just console)
5. **File-type Scripts**: Load and execute external script files
6. **Pre-request Scripts**: Execute scripts before sending the request

## Security Notes

The current implementation provides a basic security boundary:
- Scripts cannot access Node.js APIs
- Scripts cannot access the filesystem
- Scripts cannot make network requests
- Scripts cannot access the parent process

However, this is still early stage. Future enhancements should include:
- Memory limits
- More restrictive timeout handling
- Audit logging of script execution
- User confirmation for script execution
- Script signing/verification for shared collections

