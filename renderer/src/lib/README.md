# Collection Data Structure

This directory contains the data structures and state management for collections in Thulu.

## Architecture

### Files

- **`collection.ts`** - TypeScript interfaces defining the collection data structure
  - `CurrentCollection` - Full collection data including items and metadata
  - `CollectionItem` - Individual items within a collection (folders and/or HTTP files)
  - `HttpSection` - Section within an HTTP file
  - `CollectionConfig` - Configuration from `.thulu.json` file

- **`httpParser.ts`** - HTTP file parsing logic
  - `parseHttpFile()` - Parses HTTP file content and extracts sections
  - `ParsedHttpFile` - Interface for parsed file result
  - Sections are defined by lines starting with `###`

- **`stores/currentCollection.ts`** - Svelte store for managing current collection state
  - `currentCollection` - Main writable store containing the active collection
  - `hasCurrentCollection` - Derived store (boolean) indicating if a collection is loaded
  - `currentCollectionName` - Derived store for the current collection name
  - `loadCollection()` - Async method to load a collection from filesystem and parse all HTTP files
  - `clear()` - Method to clear the current collection

### Usage

#### In Svelte Components

```svelte
<script lang="ts">
    import { currentCollection, hasCurrentCollection, currentCollectionName } from '$lib/stores/currentCollection.js';
    import type { CurrentCollection } from '$lib/collection';

    // Subscribe to the store
    $: console.log($currentCollection);

    // Load a collection (automatically parses HTTP files)
    function openCollection(path: string, name: string) {
        currentCollection.loadCollection(path, name);
    }

    // Check if collection exists
    $: if ($hasCurrentCollection) {
        console.log('Collection is loaded:', $currentCollectionName);
    }
</script>

{#if $hasCurrentCollection}
    <div>Current collection: {$currentCollectionName}</div>
{/if}
```

#### HTTP File Parsing

HTTP files are automatically parsed when a collection is loaded. Sections are defined by lines starting with `###`:

```http
### Get Users
GET https://api.example.com/users

### Create User  
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John"
}
```

This creates two sections:
- "Get Users" at line 1
- "Create User" at line 4

If no text follows `###`, the section name defaults to "Untitled".

### Design Decisions

1. **Separation of Concerns**: Collection types are separate from global types to keep them manageable
2. **Svelte Store Pattern**: Uses Svelte's reactive store pattern for state management across components
3. **Derived Stores**: Provides convenient derived stores for common use cases (name, exists check)
4. **Async Loading**: Collection loading is async to support filesystem operations via IPC
5. **HTTP Parsing**: Files are parsed during collection load to extract sections for navigation
6. **Type Safety**: Full TypeScript support with proper interfaces

### Future Extensions

The `CurrentCollection` interface can be extended with:
- Search/filter state
- Sorting preferences
- View modes
- Selection state
- Undo/redo history
- etc.

All without modifying the global types or affecting other parts of the application.

