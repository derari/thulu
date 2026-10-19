import { describe, expect, it } from 'vitest';
import {
    copyVariables,
    createVariable,
    overrideInherited,
    revertToInherited,
    toggleDelete,
    toggleInheritance
} from './environmentDraft';
import type { EnvironmentVariable } from './environmentParser';

function variable(overrides: Partial<EnvironmentVariable> = {}): EnvironmentVariable {
    return {
        name: 'host',
        value: 'local',
        isPrivate: false,
        source: 'api',
        isInherited: false,
        isOverridden: false,
        isShared: false,
        isEditable: true,
        ...overrides
    };
}

const overriding = () =>
    variable({
        isOverridden: true,
        parentValue: 'root-value',
        parentIsPrivate: true,
        parentSource: 'root'
    });

const inherited = () =>
    variable({ value: 'root-value', source: 'root', isInherited: true, isEditable: false });

describe('createVariable', () => {
    it('picks the first free newVar name', () => {
        expect(createVariable([], 'api').name).toBe('newVar0');
        expect(createVariable(['newVar0', 'newVar1'], 'api').name).toBe('newVar2');
        expect(createVariable(['newVar1'], 'api').name).toBe('newVar0');
    });

    it('creates an editable local variable', () => {
        expect(createVariable([], 'api')).toMatchObject({
            value: '',
            source: 'api',
            isEditable: true,
            isInherited: false,
            isOverridden: false,
            isShared: false
        });
    });
});

describe('revertToInherited', () => {
    it('shows the parent value and keeps the local value as the parent value', () => {
        const v = overriding();

        revertToInherited(v);

        expect(v).toMatchObject({
            value: 'root-value',
            isPrivate: true,
            source: 'root',
            isInherited: true,
            isOverridden: false,
            isEditable: false,
            parentValue: 'local',
            parentIsPrivate: false
        });
    });

    it('does nothing without a parent value', () => {
        const v = variable({ isOverridden: true });

        revertToInherited(v);

        expect(v.isOverridden).toBe(true);
        expect(v.value).toBe('local');
    });
});

describe('overrideInherited', () => {
    it('keeps the inherited value as the parent value when there was no local value', () => {
        const v = inherited();

        overrideInherited(v);

        expect(v).toMatchObject({
            value: 'root-value',
            isInherited: false,
            isOverridden: true,
            isEditable: true,
            parentValue: 'root-value',
            parentSource: 'root'
        });
    });

    it('round-trips with revertToInherited', () => {
        const v = overriding();

        revertToInherited(v);
        overrideInherited(v);

        expect(v).toMatchObject({
            value: 'local',
            isPrivate: false,
            isOverridden: true,
            isInherited: false,
            parentValue: 'root-value',
            parentSource: 'root'
        });
    });
});

describe('toggleInheritance', () => {
    it('overrides inherited variables and reverts overriding ones', () => {
        const a = inherited();
        toggleInheritance(a);
        expect(a.isOverridden).toBe(true);

        toggleInheritance(a);
        expect(a.isInherited).toBe(true);
    });

    it('ignores plain local variables', () => {
        const v = variable();
        toggleInheritance(v);
        expect(v).toEqual(variable());
    });
});

describe('toggleDelete', () => {
    it('marks a local variable as deleted and restores it again', () => {
        const v = variable();

        const deleted = toggleDelete(v, new Set());
        expect(deleted.has('host')).toBe(true);

        expect(toggleDelete(v, deleted).has('host')).toBe(false);
    });

    it('does not modify the given set', () => {
        const original = new Set<string>();
        toggleDelete(variable(), original);
        expect(original.size).toBe(0);
    });

    it('reverts overriding variables instead of deleting them', () => {
        const v = overriding();

        const deleted = toggleDelete(v, new Set());

        expect(deleted.size).toBe(0);
        expect(v.isInherited).toBe(true);
    });

    it('does not delete inherited variables', () => {
        expect(toggleDelete(inherited(), new Set()).size).toBe(0);
    });
});

describe('copyVariables', () => {
    it('makes an independent copy', () => {
        const original = [variable()];
        const copy = copyVariables(original);

        copy[0].value = 'changed';

        expect(original[0].value).toBe('local');
    });
});
