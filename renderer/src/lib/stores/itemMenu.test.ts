import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { itemMenu } from './itemMenu';

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    itemMenu.close();
    itemMenu.requestDelete('reset', async () => {});
    vi.useRealTimers();
});

describe('itemMenu', () => {
    it('opens one menu at a time and closes it when toggled again', () => {
        itemMenu.toggle('a');
        expect(get(itemMenu.openKey)).toBe('a');

        itemMenu.toggle('b');
        expect(get(itemMenu.openKey)).toBe('b');

        itemMenu.toggle('b');
        expect(get(itemMenu.openKey)).toBeNull();
    });

    it('closes the menu when a delete is requested', () => {
        itemMenu.toggle('a');

        itemMenu.requestDelete('a', async () => {});

        expect(get(itemMenu.openKey)).toBeNull();
        expect(get(itemMenu.confirmingKey)).toBe('a');
    });

    it('runs the delete once when confirmed', async () => {
        const performDelete = vi.fn().mockResolvedValue(undefined);
        itemMenu.requestDelete('a', performDelete);

        await itemMenu.confirmDelete();
        await itemMenu.confirmDelete();

        expect(performDelete).toHaveBeenCalledTimes(1);
        expect(get(itemMenu.confirmingKey)).toBeNull();
    });

    it('drops the pending delete after the timeout', async () => {
        const performDelete = vi.fn();
        itemMenu.requestDelete('a', performDelete);

        vi.advanceTimersByTime(10000);
        await itemMenu.confirmDelete();

        expect(get(itemMenu.confirmingKey)).toBeNull();
        expect(performDelete).not.toHaveBeenCalled();
    });

    it('drops the pending delete when another menu is opened', async () => {
        const performDelete = vi.fn();
        itemMenu.requestDelete('a', performDelete);

        itemMenu.toggle('b');
        await itemMenu.confirmDelete();

        expect(performDelete).not.toHaveBeenCalled();
    });

    it('replaces an earlier pending delete', async () => {
        const first = vi.fn();
        const second = vi.fn();
        itemMenu.requestDelete('a', first);
        itemMenu.requestDelete('b', second);

        await itemMenu.confirmDelete();

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalled();
    });
});
