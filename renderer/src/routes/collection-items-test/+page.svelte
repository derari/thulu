<script lang="ts">
import CollectionItems from '../../lib/CollectionItems.svelte';
import { currentCollection } from '../../lib/stores/currentCollection';
import type {CollectionItem, CurrentCollection, EnvironmentConfig} from '../../lib/collection';

const mockEnv: EnvironmentConfig = {
  folderPath: '/env',
  hasPublicEnv: true,
  hasPrivateEnv: false
};

const mockSection = {
  name: 'Test',
  startLineNumber: 1,
  endLineNumber: 2,
  verb: 'GET',
  url: 'url',
  isDivider: false
};

const mockFile: CollectionItem = {
  title: 'File',
  filePath: '/file.http',
  items: [],
  sections: [mockSection]
};

const mockFolder: CollectionItem = {
  title: 'Folder',
  folderPath: '/folder',
  items: [mockFile],
  environments: mockEnv
};

const mockRoot: CollectionItem = {
  title: 'Root',
  folderPath: '/root',
  items: [mockFolder],
  environments: mockEnv
};

currentCollection.set({ root: mockRoot, path: '/root' } as CurrentCollection);
</script>

<CollectionItems />
