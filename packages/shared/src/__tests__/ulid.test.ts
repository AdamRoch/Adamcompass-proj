import { describe, expect, it } from 'vitest';
import { clientUlid, isUlid, newUlid } from '../ulid.js';

describe('isUlid', () => {
  it('accepts canonical ULIDs', () => {
    expect(isUlid('01HSC4Y3FAKERUNULIDXXXXXX')).toBe(false); // wrong length on purpose
    expect(isUlid('01HSC4Y3FAKERUNULID0000000')).toBe(false); // 25 chars
    const real = newUlid();
    expect(isUlid(real)).toBe(true);
    expect(real).toHaveLength(26);
  });

  it('rejects malformed inputs', () => {
    expect(isUlid('')).toBe(false);
    expect(isUlid('not-a-ulid')).toBe(false);
    expect(isUlid(null)).toBe(false);
    expect(isUlid(undefined)).toBe(false);
    expect(isUlid(123)).toBe(false);
    // Lowercase characters are not Crockford base32 (uppercase only).
    expect(isUlid('01hsc4y3fakerunulid00000a0')).toBe(false);
    // Forbidden chars: I, L, O, U
    expect(isUlid('01HSC4Y3FAKERUNULIIIIIIIII')).toBe(false);
  });
});

describe('newUlid', () => {
  it('returns a monotonically increasing sequence within a tight loop', () => {
    const a = newUlid();
    const b = newUlid();
    const c = newUlid();
    expect(a < b).toBe(true);
    expect(b < c).toBe(true);
  });

  it('produces ULIDs that round-trip through isUlid()', () => {
    for (let i = 0; i < 50; i++) {
      const id = newUlid();
      expect(isUlid(id)).toBe(true);
    }
  });

  it('accepts a seed time and respects ordering', () => {
    // Same seed → monotonic factory still bumps the random tail to keep order.
    const t = Date.UTC(2026, 4, 23, 12);
    const a = newUlid(t);
    const b = newUlid(t);
    expect(a < b).toBe(true);
  });
});

describe('clientUlid', () => {
  it('returns a valid (but not necessarily monotonic) ULID', () => {
    const id = clientUlid();
    expect(isUlid(id)).toBe(true);
  });
});
