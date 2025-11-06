# Thulu

A modern REST client built on HTTP files, providing a clean and efficient way to test and debug HTTP APIs.

## Features

### HTTP File Support
- **Request definitions** using `.http` files with an intuitive syntax
- **Multiple requests per file** organized with section markers (`###`)
- **Request naming** for easy identification and navigation
- **Variable substitution** with `{{variableName}}` syntax

### Environment Management
- **Hierarchical environments** with inheritance from parent folders
- **Public and private environment files** (`http-client.env.json` and `http-client.private.env.json`)
- **Variable overriding** - child folders can override parent values
- **Environment selector** to switch between different configurations (dev, staging, production, etc.)

### Collections
- **Folder-based organization** - your file system is your collection structure
- **Nested folders** with environment inheritance
- **Sidebar navigation** with collapsible folder trees
- **Request history** and section navigation

### Scripting & Automation
- **Post-request scripts** using JavaScript syntax (`> {% ... %}`)
- **Response assertions** and data extraction
- **Global variables** accessible across requests
- **Client object** for managing state and environment

### UI & Experience
- **Syntax highlighting** for HTTP requests, JSON, and other formats
- **Response viewer** with formatted JSON, headers, and status codes
- **Theme support** - system, light, and dark modes
- **Resizable sidebar** with persistent width
- **Keyboard shortcuts** for common actions

### Additional Features
- **Request body highlighting** with language detection
- **File and folder management** - create, rename, and delete directly from the UI
- **Response body display** with syntax highlighting
- **Collection management** - switch between multiple collections

## How It Works

Thulu is built as an Electron application with a Svelte frontend:

1. **File System as Database** - Your HTTP files and environment configurations live in your file system, making them easy to version control and share
2. **Parser Architecture** - HTTP files are parsed to extract requests, headers, bodies, and scripts
3. **Environment Resolution** - Variables are resolved by walking up the folder hierarchy, merging environment files from child to parent
4. **Request Execution** - Requests are executed using Node's HTTP capabilities, with full control over headers, body, and authentication
5. **Script Execution** - Post-request scripts run in a sandboxed environment with access to response data and global state

## More about .http files

(Not all features mentioned in these sources are implemented in Thulu)

* [Exploring .http Syntax by Jetbrains](https://www.jetbrains.com/help/idea/exploring-http-syntax.html)
* [Use .http files in Visual Studio](https://learn.microsoft.com/en-us/aspnet/core/test/http-files?view=aspnetcore-9.0#http-file-syntax)

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Install dependencies for the main process
npm install

# Install dependencies for the renderer process
cd renderer
npm install
cd ..
```

### Running in Development Mode

Start the Vite dev server and Electron:

```bash
# Terminal 1: Start the renderer dev server
cd renderer
npm run dev

# Terminal 2: Start Electron (from root)
npm run dev
```

The application will launch with hot-reload enabled for the renderer process.

### Running Tests

```bash
# Run all tests
cd renderer
npm test

# Run tests in watch mode
npm test -- --watch

# Run a specific test file
npm test -- environmentParser.test.ts

# Run tests with coverage
npm test -- --coverage
```

### Building for Production

```bash
# Build the renderer
cd renderer
npm run build
cd ..

# Build the Electron app
npm run build
```

The built application will be in the `dist-packages` directory.

## Project Structure

```
thulu/
├── src/                    # Main process (Electron)
│   ├── main.ts            # Application entry point
│   ├── preload.ts         # Preload script for IPC
│   ├── fileOperations.ts  # File system operations
│   └── scriptExecutor.ts  # Script execution engine
├── renderer/              # Renderer process (Svelte)
│   ├── src/
│   │   ├── routes/       # SvelteKit routes
│   │   └── lib/          # Shared components and utilities
│   │       ├── editor/   # HTTP file parsing and editing
│   │       ├── stores/   # Svelte stores for state management
│   │       └── *.svelte  # UI components
│   └── static/           # Static assets
├── collections/          # Example HTTP collections
├── docs/                 # Documentation
└── production/           # Build assets (icons, etc.)
```

## HTTP File Syntax

```http
### Get User
GET https://api.example.com/users/{{userId}}
Authorization: Bearer {{token}}

### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

> {%
  client.global.set("userId", response.body.id);
%}
```

## Environment Files

**http-client.env.json** (public):
```json
{
  "dev": {
    "baseUrl": "http://localhost:3000",
    "apiKey": "dev-key"
  },
  "production": {
    "baseUrl": "https://api.example.com",
    "apiKey": "prod-key"
  }
}
```

## License

See [LICENSE.md](LICENSE.md) for details.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

