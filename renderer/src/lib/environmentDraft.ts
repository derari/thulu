import type { EnvironmentVariable } from './environmentParser';

/** Pure edit operations on the variables shown in the environments view; they mutate the variable they are given. */

export function copyVariables(variables: EnvironmentVariable[]): EnvironmentVariable[] {
    return JSON.parse(JSON.stringify(variables));
}

/** A new local variable with a name that is not taken yet. */
export function createVariable(existingNames: string[], source: string): EnvironmentVariable {
    let index = 0;
    while (existingNames.includes(`newVar${index}`)) {
        index++;
    }

    return {
        name: `newVar${index}`,
        value: '',
        isPrivate: false,
        source,
        isInherited: false,
        isOverridden: false,
        isShared: false,
        isEditable: true
    };
}

/** Swaps an overriding local variable back to the inherited value, keeping the local value as the parent value. */
export function revertToInherited(variable: EnvironmentVariable): void {
    if (variable.parentValue === undefined) {
        return;
    }

    const localValue = variable.value;
    const localIsPrivate = variable.isPrivate;

    variable.value = variable.parentValue;
    variable.isPrivate = variable.parentIsPrivate!;
    variable.source = variable.parentSource!;
    variable.isInherited = true;
    variable.isOverridden = false;
    variable.isEditable = false;

    variable.parentValue = localValue;
    variable.parentIsPrivate = localIsPrivate;
}

/** Makes an inherited variable editable, so that the folder overrides the inherited value. */
export function overrideInherited(variable: EnvironmentVariable): void {
    if (variable.parentValue !== undefined) {
        // Restores the local value that was set aside by an earlier revert
        const inheritedValue = variable.value;
        const inheritedIsPrivate = variable.isPrivate;
        const inheritedSource = variable.source;

        variable.value = variable.parentValue;
        variable.isPrivate = variable.parentIsPrivate!;

        variable.parentValue = inheritedValue;
        variable.parentIsPrivate = inheritedIsPrivate;
        variable.parentSource = inheritedSource;
    } else {
        variable.parentValue = variable.value;
        variable.parentIsPrivate = variable.isPrivate;
        variable.parentSource = variable.source;
    }

    variable.isInherited = false;
    variable.isOverridden = true;
    variable.isEditable = true;
}

/** Switches an inherited variable to overriding, or an overriding one back to inherited. */
export function toggleInheritance(variable: EnvironmentVariable): void {
    if (variable.isInherited) {
        overrideInherited(variable);
    } else if (variable.isOverridden) {
        revertToInherited(variable);
    }
}

/**
 * The delete action of a local variable: overriding variables revert to the inherited value,
 * plain local variables are marked for deletion (or restored). Returns the updated set of deleted names.
 */
export function toggleDelete(variable: EnvironmentVariable, deletedNames: Set<string>): Set<string> {
    if (variable.isOverridden) {
        revertToInherited(variable);
        return deletedNames;
    }

    const updated = new Set(deletedNames);
    if (!variable.isInherited) {
        if (updated.has(variable.name)) {
            updated.delete(variable.name);
        } else {
            updated.add(variable.name);
        }
    }
    return updated;
}
