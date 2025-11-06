import { describe, it, expect, beforeEach } from 'vitest';
import { globalVariables } from './globalVariables';

describe('Global Variables Store', () => {
	const testCollection1 = '/path/to/collection1';
	const testCollection2 = '/path/to/collection2';

	beforeEach(() => {
		globalVariables.clearAll();
	});

	it('should get empty object for collection with no variables', () => {
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({});
	});

	it('should set and get a variable', () => {
		globalVariables.set(testCollection1, 'key', 'value');
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({ key: 'value' });
	});

	it('should set multiple variables', () => {
		globalVariables.set(testCollection1, 'key1', 'value1');
		globalVariables.set(testCollection1, 'key2', 'value2');
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({ key1: 'value1', key2: 'value2' });
	});

	it('should override existing variable', () => {
		globalVariables.set(testCollection1, 'key', 'value1');
		globalVariables.set(testCollection1, 'key', 'value2');
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({ key: 'value2' });
	});

	it('should delete a variable', () => {
		globalVariables.set(testCollection1, 'key1', 'value1');
		globalVariables.set(testCollection1, 'key2', 'value2');
		globalVariables.delete(testCollection1, 'key1');
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({ key2: 'value2' });
	});

	it('should handle deleting non-existent variable', () => {
		globalVariables.set(testCollection1, 'key', 'value');
		globalVariables.delete(testCollection1, 'nonexistent');
		const vars = globalVariables.get(testCollection1);
		expect(vars).toEqual({ key: 'value' });
	});

	it('should isolate variables between collections', () => {
		globalVariables.set(testCollection1, 'key', 'value1');
		globalVariables.set(testCollection2, 'key', 'value2');

		expect(globalVariables.get(testCollection1)).toEqual({ key: 'value1' });
		expect(globalVariables.get(testCollection2)).toEqual({ key: 'value2' });
	});

	it('should clear all variables for a collection', () => {
		globalVariables.set(testCollection1, 'key1', 'value1');
		globalVariables.set(testCollection1, 'key2', 'value2');
		globalVariables.set(testCollection2, 'key', 'value');

		globalVariables.clear(testCollection1);

		expect(globalVariables.get(testCollection1)).toEqual({});
		expect(globalVariables.get(testCollection2)).toEqual({ key: 'value' });
	});

	it('should clear all variables for all collections', () => {
		globalVariables.set(testCollection1, 'key1', 'value1');
		globalVariables.set(testCollection2, 'key2', 'value2');

		globalVariables.clearAll();

		expect(globalVariables.get(testCollection1)).toEqual({});
		expect(globalVariables.get(testCollection2)).toEqual({});
	});

	it('should handle clearing non-existent collection', () => {
		globalVariables.set(testCollection1, 'key', 'value');
		globalVariables.clear(testCollection2);
		expect(globalVariables.get(testCollection1)).toEqual({ key: 'value' });
	});
});

