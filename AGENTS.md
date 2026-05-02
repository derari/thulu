# AGENTS.md — Thulu Codebase Guide

## What Is Thulu
An Electron + SvelteKit desktop REST client that uses `.http` files as its data format. The file system *is* the database — no internal DB, just files and folders.

## Architecture Overview

Two separate Node processes with distinct `package.json` files:

| Layer | Location | Tech | Role |
|---|---|---|---|
| Main process | `src/` | TypeScript + Electron | File I/O, HTTP execution, script sandboxing |
| Renderer process | `renderer/` | SvelteKit + Svelte 5 + CodeMirror 6 | All UI |

Communication is **exclusively via Electron IPC**. The bridge is defined in `src/preload.ts` and exposed as `window.electronAPI`. The renderer never touches Node APIs directly.

IPC channels follow the pattern `domain:action` (e.g., `fs:readFile`, `http:request`, `script:execute`). Every new capability added to the main process must be: registered in `src/main.ts` → exposed in `src/preload.ts` → typed in `renderer/src/app.d.ts`.

## Key Data Flow

```
.http file  →  httpParser.ts  →  HttpSection[]  →  CollectionItem (store)
                                                         ↓
env files  →  environmentParser.ts  →  variable map  →  httpRequestExecutor.ts  →  IPC http:request
                                                                                          ↓
post-script  ←  IPC script:execute  ←  scriptExecutor.ts (sandboxed vm)         response
```

## Critical Files

- `renderer/src/lib/collection.ts` — canonical TypeScript interfaces for all domain types (`HttpSection`, `CollectionItem`, `EnvironmentConfig`, etc.)
- `renderer/src/lib/editor/httpParser.ts` — parses `.http` files into `ParsedHttpFile`
- `renderer/src/lib/editor/httpRequestExecutor.ts` — resolves variables and fires requests
- `renderer/src/lib/environmentParser.ts` — merges `http-client.env.json` hierarchically up the folder tree
- `renderer/src/lib/stores/` — Svelte stores: `currentCollection`, `globalVariables`, `openFile`, `httpResponse`, `theme`
- `src/scriptExecutor.ts` — runs post-request `> {% ... %}` scripts in a Node `vm` sandbox
- `src/fileOperations.ts` — all filesystem helpers used by IPC handlers in `src/main.ts`

## Developer Workflows

```bash
# Install (must install both workspaces)
npm install                  # root (Electron deps)
cd renderer && npm install   # renderer deps

# Dev (two terminals)
cd renderer && npm run dev   # start Vite at :5173
npm run dev                  # compile TS + launch Electron (connects to Vite)

# Tests
npm run test:electron        # vitest in src/
npm run test:renderer        # vitest in renderer/src/
npm test                     # both

# E2E (Playwright, renderer only)
cd renderer && npm run test:e2e

# Production build & package
npm run build                # compiles TS + Vite
npm run package              # electron-builder → dist-packages/
```

> In dev mode, Electron connects to the Vite dev server. In production, it uses `electron-serve` to serve the static Svelte build.

## Project-Specific Conventions

- **No shared `node_modules`**: root and `renderer/` have separate `package.json`. Never add renderer UI deps to the root and vice versa.
- **Collection config**: Each opened collection folder gets a `.thulu.json` file at its root storing `collectionName`. Preferences (window size, collection list) are stored via `loadPreferences`/`savePreferences` in `src/fileOperations.ts`.
- **Environment inheritance**: `http-client.env.json` files are merged from child folder up to root; child values win. Private env (`http-client.private.env.json`) is merged on top of public env.
- **Variable precedence**: preamble `@var = value` → environment file → global variables set by scripts via `client.global.set(key, value)`.
- **Section marker**: `###` starts a new request block; a section with no HTTP verb is a divider/comment section (`isDivider: true`).
- **Post-scripts** follow the request body with `> {% ... %}` syntax; `> filename.js` references an external script file.
- **Svelte stores** are custom factory functions (e.g., `createCurrentCollectionStore`) that extend the base writable with domain methods — see `renderer/src/lib/stores/currentCollection.ts` as the pattern.

## Testing Patterns

- Unit tests live alongside source files (e.g., `httpParser.test.ts` next to `httpParser.ts`).
- Integration tests are named `*.integration.test.ts`.
- Tests in `renderer/` run in a browser-like Vitest environment; tests in `src/` run in Node.
- The renderer tests **cannot** use `window.electronAPI` — mock it if needed.

