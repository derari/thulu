import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {getEnvironmentVariables, listAvailableEnvironments} from './environmentParser';
import type {EnvironmentVariable, AvailableEnvironment} from './environmentParser';
import type {CurrentCollection} from './collection';

// Mock the window.electronAPI
const mockReadFile = vi.fn();

beforeEach(() => {
    global.window = {
        electronAPI: {
            readFile: mockReadFile
        }
    } as any;
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('environmentParser - nested folder inheritance', () => {
    const collectionRoot = '/collection';
    const alicePath = '/collection/alice';
    const bobPath = '/collection/alice/bob';
    const carolPath = '/collection/alice/bob/carol';

    // Variable patterns: abc where x means not defined in that folder
    // Pattern naming: a=alice, b=bob, c=carol
    // xxx - not defined anywhere (not tested, would not exist)
    // xxc - only in carol
    // xbc - only in bob and carol
    // xbx - only in bob
    // axc - only in alice and carol
    // abc - in all three folders
    // abx - in alice and bob
    // axx - only in alice

    const aliceEnvFile = {
        test: {
            axc: 'alice',
            abc: 'alice',
            abx: 'alice',
            axx: 'alice'
        },
		test_ab: {
			ab: 'alice',
		}
    };

    const bobEnvFile = {
        test: {
            xbc: 'bob',
            xbx: 'bob',
            abc: 'bob',
            abx: 'bob'
        },
		test_ab: {
			ab: 'bob',
		}
    };

    const carolEnvFile = {
        test: {
            xxc: 'carol',
            xbc: 'carol',
            axc: 'carol',
            abc: 'carol'
        },
    };

    beforeEach(() => {
        mockReadFile.mockImplementation(async (path: string) => {
            if (path === `${carolPath}/http-client.env.json`) {
                return JSON.stringify(carolEnvFile);
            }
            if (path === `${bobPath}/http-client.env.json`) {
                return JSON.stringify(bobEnvFile);
            }
            if (path === `${alicePath}/http-client.env.json`) {
                return JSON.stringify(aliceEnvFile);
            }
            throw new Error('File not found');
        });
    });

    it('should correctly load variables from carol', async () => {
        const variables = await getEnvironmentVariables('test', carolPath, collectionRoot);

        // Convert to map for easier testing
        const varMap = new Map<string, EnvironmentVariable>();
        for (const v of variables) {
            varMap.set(v.name, v);
        }

        expect(variables).toHaveLength(7);

        // xxc - only defined in carol
        const xxc = varMap.get('xxc');
        expect(xxc).toBeDefined();
        expect(xxc!.value).toBe('carol');
        expect(xxc!.source).toBe('carol');
        expect(xxc!.isInherited).toBe(false);
        expect(xxc!.isOverridden).toBe(false);
        expect(xxc!.isEditable).toBe(true);
        expect(xxc!.isPrivate).toBe(false);
        expect(xxc!.parentValue).toBeUndefined();
        expect(xxc!.parentSource).toBeUndefined();

        // xbc - defined in bob and carol (carol overrides bob)
        const xbc = varMap.get('xbc');
        expect(xbc).toBeDefined();
        expect(xbc!.value).toBe('carol');
        expect(xbc!.source).toBe('carol');
        expect(xbc!.isInherited).toBe(false);
        expect(xbc!.isOverridden).toBe(true);
        expect(xbc!.isEditable).toBe(true);
        expect(xbc!.isPrivate).toBe(false);
        expect(xbc!.parentValue).toBe('bob');
        expect(xbc!.parentSource).toBe('bob');
        expect(xbc!.parentIsPrivate).toBe(false);

        // xbx - only defined in bob (carol inherits from bob)
        const xbx = varMap.get('xbx');
        expect(xbx).toBeDefined();
        expect(xbx!.value).toBe('bob');
        expect(xbx!.source).toBe('bob');
        expect(xbx!.isInherited).toBe(true);
        expect(xbx!.isOverridden).toBe(false);
        expect(xbx!.isEditable).toBe(false);
        expect(xbx!.isPrivate).toBe(false);
        expect(xbx!.parentValue).toBeUndefined();
        expect(xbx!.parentSource).toBeUndefined();

        // axc - defined in alice and carol (carol overrides alice, bob doesn't have it)
        const axc = varMap.get('axc');
        expect(axc).toBeDefined();
        expect(axc!.value).toBe('carol');
        expect(axc!.source).toBe('carol');
        expect(axc!.isInherited).toBe(false);
        expect(axc!.isOverridden).toBe(true);
        expect(axc!.isEditable).toBe(true);
        expect(axc!.isPrivate).toBe(false);
        expect(axc!.parentValue).toBe('alice');
        expect(axc!.parentSource).toBe('alice');
        expect(axc!.parentIsPrivate).toBe(false);

        // abc - defined in all three (carol overrides bob which overrides alice)
        const abc = varMap.get('abc');
        expect(abc).toBeDefined();
        expect(abc!.value).toBe('carol');
        expect(abc!.source).toBe('carol');
        expect(abc!.isInherited).toBe(false);
        expect(abc!.isOverridden).toBe(true);
        expect(abc!.isEditable).toBe(true);
        expect(abc!.isPrivate).toBe(false);
        expect(abc!.parentValue).toBe('bob');
        expect(abc!.parentSource).toBe('bob');
        expect(abc!.parentIsPrivate).toBe(false);

        // abx - defined in alice and bob (carol inherits from bob, bob overrides alice but carol doesn't override anything)
        const abx = varMap.get('abx');
        expect(abx).toBeDefined();
        expect(abx!.value).toBe('bob');
        expect(abx!.source).toBe('bob');
        expect(abx!.isInherited).toBe(true);
        expect(abx!.isOverridden).toBe(false);
        expect(abx!.isEditable).toBe(false);
        expect(abx!.isPrivate).toBe(false);
        expect(abx!.parentValue).toBeUndefined();
        expect(abx!.parentSource).toBeUndefined();
        expect(abx!.parentIsPrivate).toBeUndefined();

        // axx - only defined in alice (carol inherits from alice)
        const axx = varMap.get('axx');
        expect(axx).toBeDefined();
        expect(axx!.value).toBe('alice');
        expect(axx!.source).toBe('alice');
        expect(axx!.isInherited).toBe(true);
        expect(axx!.isOverridden).toBe(false);
        expect(axx!.isEditable).toBe(false);
        expect(axx!.isPrivate).toBe(false);
        expect(axx!.parentValue).toBeUndefined();
        expect(axx!.parentSource).toBeUndefined();
    });

    it('should correctly load variables from bob', async () => {
        const variables = await getEnvironmentVariables('test', bobPath, collectionRoot);

        const varMap = new Map<string, EnvironmentVariable>();
        for (const v of variables) {
            varMap.set(v.name, v);
        }

        expect(variables).toHaveLength(6); // xxc is not visible from bob

        // xbc - defined in bob and carol, but bob sees its own value
        const xbc = varMap.get('xbc');
        expect(xbc).toBeDefined();
        expect(xbc!.value).toBe('bob');
        expect(xbc!.source).toBe('bob');
        expect(xbc!.isInherited).toBe(false);
        expect(xbc!.isOverridden).toBe(false);
        expect(xbc!.isEditable).toBe(true);

        // xbx - only defined in bob
        const xbx = varMap.get('xbx');
        expect(xbx).toBeDefined();
        expect(xbx!.value).toBe('bob');
        expect(xbx!.source).toBe('bob');
        expect(xbx!.isInherited).toBe(false);
        expect(xbx!.isOverridden).toBe(false);
        expect(xbx!.isEditable).toBe(true);

        // abc - defined in alice, bob, and carol; bob sees its own value overriding alice
        const abc = varMap.get('abc');
        expect(abc).toBeDefined();
        expect(abc!.value).toBe('bob');
        expect(abc!.source).toBe('bob');
        expect(abc!.isInherited).toBe(false);
        expect(abc!.isOverridden).toBe(true);
        expect(abc!.isEditable).toBe(true);
        expect(abc!.parentValue).toBe('alice');
        expect(abc!.parentSource).toBe('alice');

        // abx - defined in alice and bob; bob sees its own value overriding alice
        const abx = varMap.get('abx');
        expect(abx).toBeDefined();
        expect(abx!.value).toBe('bob');
        expect(abx!.source).toBe('bob');
        expect(abx!.isInherited).toBe(false);
        expect(abx!.isOverridden).toBe(true);
        expect(abx!.isEditable).toBe(true);
        expect(abx!.parentValue).toBe('alice');
        expect(abx!.parentSource).toBe('alice');

        // axc - defined in alice and carol; bob inherits from alice
        const axc = varMap.get('axc');
        expect(axc).toBeDefined();
        expect(axc!.value).toBe('alice');
        expect(axc!.source).toBe('alice');
        expect(axc!.isInherited).toBe(true);
        expect(axc!.isOverridden).toBe(false);
        expect(axc!.isEditable).toBe(false);

        // axx - only defined in alice; bob inherits
        const axx = varMap.get('axx');
        expect(axx).toBeDefined();
        expect(axx!.value).toBe('alice');
        expect(axx!.source).toBe('alice');
        expect(axx!.isInherited).toBe(true);
        expect(axx!.isOverridden).toBe(false);
        expect(axx!.isEditable).toBe(false);
    });

    it('should correctly load variables from alice', async () => {
        const variables = await getEnvironmentVariables('test', alicePath, collectionRoot);

        const varMap = new Map<string, EnvironmentVariable>();
        for (const v of variables) {
            varMap.set(v.name, v);
        }

        expect(variables).toHaveLength(4); // Only alice's variables

        // axc - defined in alice
        const axc = varMap.get('axc');
        expect(axc).toBeDefined();
        expect(axc!.value).toBe('alice');
        expect(axc!.source).toBe('alice');
        expect(axc!.isInherited).toBe(false);
        expect(axc!.isOverridden).toBe(false);
        expect(axc!.isEditable).toBe(true);

        // abc - defined in alice
        const abc = varMap.get('abc');
        expect(abc).toBeDefined();
        expect(abc!.value).toBe('alice');
        expect(abc!.source).toBe('alice');
        expect(abc!.isInherited).toBe(false);
        expect(abc!.isOverridden).toBe(false);
        expect(abc!.isEditable).toBe(true);

        // abx - defined in alice
        const abx = varMap.get('abx');
        expect(abx).toBeDefined();
        expect(abx!.value).toBe('alice');
        expect(abx!.source).toBe('alice');
        expect(abx!.isInherited).toBe(false);
        expect(abx!.isOverridden).toBe(false);
        expect(abx!.isEditable).toBe(true);

        // axx - defined in alice
        const axx = varMap.get('axx');
        expect(axx).toBeDefined();
        expect(axx!.value).toBe('alice');
        expect(axx!.source).toBe('alice');
        expect(axx!.isInherited).toBe(false);
        expect(axx!.isOverridden).toBe(false);
        expect(axx!.isEditable).toBe(true);
    });

	it('should correctly load variables of bob for carol', async () => {
		const variables = await getEnvironmentVariables('test_ab', carolPath, collectionRoot);

		// Convert to map for easier testing
		const varMap = new Map<string, EnvironmentVariable>();
		for (const v of variables) {
			varMap.set(v.name, v);
		}

		expect(variables).toHaveLength(1);

		// ab - defined in alice and bob; carol inherits from bob which overrides alice
		const ab = varMap.get('ab');
		expect(ab).toBeDefined();
		expect(ab!.value).toBe('bob');
		expect(ab!.source).toBe('bob');
		expect(ab!.isInherited).toBe(true);
		expect(ab!.isOverridden).toBe(false);
		expect(ab!.isEditable).toBe(false);
		expect(ab!.isPrivate).toBe(false);
	});
});

describe('environmentParser - listAvailableEnvironments', () => {
    const collectionRoot = '/collection';
    const alicePath = '/collection/alice';
    const bobPath = '/collection/alice/bob';
    const carolPath = '/collection/alice/bob/carol';

    const aliceEnvFile = {
        'env-axc': {},
        'env-abc': {},
        'env-abx': {},
        'env-axx': {}
    };

    const bobEnvFile = {
        'env-xbc': {},
        'env-xbx': {},
        'env-abc': {},
        'env-abx': {}
    };

    const carolEnvFile = {
        'env-xxc': {},
        'env-xbc': {},
        'env-axc': {},
        'env-abc': {}
    };

    const mockCollection: CurrentCollection = {
		metadata: {
			collectionName: 'Test Collection',
		},
        path: collectionRoot,
        name: 'Test Collection',
        root: {
            title: 'root',
            folderPath: collectionRoot,
            items: [
                {
                    title: 'alice',
                    folderPath: alicePath,
                    environments: {
                        folderPath: alicePath,
                        hasPublicEnv: true,
                        hasPrivateEnv: false
                    },
                    items: [
                        {
                            title: 'bob',
                            folderPath: bobPath,
                            environments: {
                                folderPath: bobPath,
                                hasPublicEnv: true,
                                hasPrivateEnv: false
                            },
                            items: [
                                {
                                    title: 'carol',
                                    folderPath: carolPath,
                                    environments: {
                                        folderPath: carolPath,
                                        hasPublicEnv: true,
                                        hasPrivateEnv: false
                                    },
                                    items: []
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    };

    beforeEach(() => {
        mockReadFile.mockImplementation(async (path: string) => {
            if (path === `${carolPath}/http-client.env.json`) {
                return JSON.stringify(carolEnvFile);
            }
            if (path === `${bobPath}/http-client.env.json`) {
                return JSON.stringify(bobEnvFile);
            }
            if (path === `${alicePath}/http-client.env.json`) {
                return JSON.stringify(aliceEnvFile);
            }
            throw new Error('File not found');
        });
    });

    it('should list all available environments for carol', async () => {
        const environments = await listAvailableEnvironments(carolPath, mockCollection);

        expect(environments).toHaveLength(7);

        const envMap = new Map<string, AvailableEnvironment>();
        for (const env of environments) {
            envMap.set(env.name, env);
        }

        // env-xxc - only in carol
        const xxc = envMap.get('env-xxc');
        expect(xxc).toBeDefined();
        expect(xxc!.source).toBe('carol');
        expect(xxc!.isFromCurrentFolder).toBe(true);

        // env-xbc - in bob and carol (carol's is listed first)
        const xbc = envMap.get('env-xbc');
        expect(xbc).toBeDefined();
        expect(xbc!.source).toBe('carol');
        expect(xbc!.isFromCurrentFolder).toBe(true);

        // env-xbx - only in bob (inherited by carol)
        const xbx = envMap.get('env-xbx');
        expect(xbx).toBeDefined();
        expect(xbx!.source).toBe('bob');
        expect(xbx!.isFromCurrentFolder).toBe(false);

        // env-axc - in alice and carol (carol's is listed first)
        const axc = envMap.get('env-axc');
        expect(axc).toBeDefined();
        expect(axc!.source).toBe('carol');
        expect(axc!.isFromCurrentFolder).toBe(true);

        // env-abc - in all three (carol's is listed first)
        const abc = envMap.get('env-abc');
        expect(abc).toBeDefined();
        expect(abc!.source).toBe('carol');
        expect(abc!.isFromCurrentFolder).toBe(true);

        // env-abx - in alice and bob (bob's is listed, carol inherits)
        const abx = envMap.get('env-abx');
        expect(abx).toBeDefined();
        expect(abx!.source).toBe('bob');
        expect(abx!.isFromCurrentFolder).toBe(false);

        // env-axx - only in alice (inherited by carol)
        const axx = envMap.get('env-axx');
        expect(axx).toBeDefined();
        expect(axx!.source).toBe('alice');
        expect(axx!.isFromCurrentFolder).toBe(false);
    });

    it('should list all available environments for bob', async () => {
        const environments = await listAvailableEnvironments(bobPath, mockCollection);

        expect(environments).toHaveLength(6);

        const envMap = new Map<string, AvailableEnvironment>();
        for (const env of environments) {
            envMap.set(env.name, env);
        }

        // env-xbc - in bob and carol (bob's is listed first)
        const xbc = envMap.get('env-xbc');
        expect(xbc).toBeDefined();
        expect(xbc!.source).toBe('bob');
        expect(xbc!.isFromCurrentFolder).toBe(true);

        // env-xbx - only in bob
        const xbx = envMap.get('env-xbx');
        expect(xbx).toBeDefined();
        expect(xbx!.source).toBe('bob');
        expect(xbx!.isFromCurrentFolder).toBe(true);

        // env-abc - in all three (bob's is listed first)
        const abc = envMap.get('env-abc');
        expect(abc).toBeDefined();
        expect(abc!.source).toBe('bob');
        expect(abc!.isFromCurrentFolder).toBe(true);

        // env-abx - in alice and bob (bob's is listed first)
        const abx = envMap.get('env-abx');
        expect(abx).toBeDefined();
        expect(abx!.source).toBe('bob');
        expect(abx!.isFromCurrentFolder).toBe(true);

        // env-axc - in alice and carol (alice's is visible from bob)
        const axc = envMap.get('env-axc');
        expect(axc).toBeDefined();
        expect(axc!.source).toBe('alice');
        expect(axc!.isFromCurrentFolder).toBe(false);

        // env-axx - only in alice
        const axx = envMap.get('env-axx');
        expect(axx).toBeDefined();
        expect(axx!.source).toBe('alice');
        expect(axx!.isFromCurrentFolder).toBe(false);

        // env-xxc should NOT be in the list
        expect(envMap.has('env-xxc')).toBe(false);
    });

    it('should list all available environments for alice', async () => {
        const environments = await listAvailableEnvironments(alicePath, mockCollection);

        expect(environments).toHaveLength(4); // Only alice's environments

        const envMap = new Map<string, AvailableEnvironment>();
        for (const env of environments) {
            envMap.set(env.name, env);
        }

        // All of alice's environments should be marked as isFromCurrentFolder
        expect(envMap.get('env-axc')?.isFromCurrentFolder).toBe(true);
        expect(envMap.get('env-abc')?.isFromCurrentFolder).toBe(true);
        expect(envMap.get('env-abx')?.isFromCurrentFolder).toBe(true);
        expect(envMap.get('env-axx')?.isFromCurrentFolder).toBe(true);

        // All should have alice as source
        expect(envMap.get('env-axc')?.source).toBe('alice');
        expect(envMap.get('env-abc')?.source).toBe('alice');
        expect(envMap.get('env-abx')?.source).toBe('alice');
        expect(envMap.get('env-axx')?.source).toBe('alice');

        // Bob and carol's environments should NOT be in the list
        expect(envMap.has('env-xxc')).toBe(false);
        expect(envMap.has('env-xbc')).toBe(false);
        expect(envMap.has('env-xbx')).toBe(false);
    });
});

