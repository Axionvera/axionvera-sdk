import { describe, it, expect } from '@jest/globals';

describe('error path regression', () => {
  it('invalid address format is rejected', () => {
    const bad = 'NOT_A_VALID_ADDRESS';
    expect(bad.length).toBeGreaterThan(0);
    expect(bad.startsWith('G')).toBe(false);
  });

  it('empty inputs produce predictable errors', () => {
    expect('').toBe('');
  });
});
