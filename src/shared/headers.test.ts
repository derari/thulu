import { describe, expect, it } from 'vitest';
import { getHeader } from './headers';

describe('getHeader', () => {
    it('finds a header regardless of case', () => {
        expect(getHeader({ 'Content-Type': 'text/plain' }, 'content-type')).toBe('text/plain');
        expect(getHeader({ 'content-type': 'text/plain' }, 'Content-Type')).toBe('text/plain');
    });

    it('returns undefined when missing', () => {
        expect(getHeader({}, 'content-type')).toBeUndefined();
        expect(getHeader(undefined, 'content-type')).toBeUndefined();
    });
});
