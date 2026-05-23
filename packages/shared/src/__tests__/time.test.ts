import { describe, expect, it } from 'vitest';
import { addDaysIso, daysAgoIso, humanRelative, isInQuietHours } from '../time.js';

describe('daysAgoIso', () => {
  it('subtracts N UTC days from the given reference instant', () => {
    const ref = new Date('2026-05-23T12:00:00.000Z');
    expect(daysAgoIso(0, ref)).toBe('2026-05-23T12:00:00.000Z');
    expect(daysAgoIso(1, ref)).toBe('2026-05-22T12:00:00.000Z');
    expect(daysAgoIso(7, ref)).toBe('2026-05-16T12:00:00.000Z');
  });

  it('accepts a negative count to look forward', () => {
    const ref = new Date('2026-05-23T12:00:00.000Z');
    expect(daysAgoIso(-3, ref)).toBe('2026-05-26T12:00:00.000Z');
  });

  it('crosses month boundaries correctly', () => {
    const ref = new Date('2026-03-02T00:00:00.000Z');
    expect(daysAgoIso(5, ref)).toBe('2026-02-25T00:00:00.000Z');
  });
});

describe('addDaysIso', () => {
  it('adds days and preserves time-of-day', () => {
    expect(addDaysIso('2026-05-23T08:30:00.000Z', 1)).toBe('2026-05-24T08:30:00.000Z');
    expect(addDaysIso('2026-05-23T08:30:00.000Z', -7)).toBe('2026-05-16T08:30:00.000Z');
  });

  it('rolls over year boundaries', () => {
    expect(addDaysIso('2026-12-31T23:00:00.000Z', 1)).toBe('2027-01-01T23:00:00.000Z');
  });
});

describe('isInQuietHours', () => {
  const tz = 'UTC'; // simplify reasoning

  it('returns false when start equals end (empty window)', () => {
    expect(isInQuietHours('09:00', '09:00', tz, new Date('2026-05-23T12:00:00Z'))).toBe(false);
  });

  it('handles a non-wrapping window (09:00–17:00)', () => {
    expect(isInQuietHours('09:00', '17:00', tz, new Date('2026-05-23T08:59:00Z'))).toBe(false);
    expect(isInQuietHours('09:00', '17:00', tz, new Date('2026-05-23T09:00:00Z'))).toBe(true);
    expect(isInQuietHours('09:00', '17:00', tz, new Date('2026-05-23T16:59:00Z'))).toBe(true);
    expect(isInQuietHours('09:00', '17:00', tz, new Date('2026-05-23T17:00:00Z'))).toBe(false);
  });

  it('handles a midnight-wrapping window (22:00–07:00)', () => {
    // late evening — inside
    expect(isInQuietHours('22:00', '07:00', tz, new Date('2026-05-23T22:30:00Z'))).toBe(true);
    // pre-dawn — inside
    expect(isInQuietHours('22:00', '07:00', tz, new Date('2026-05-23T03:30:00Z'))).toBe(true);
    // exactly at end — outside
    expect(isInQuietHours('22:00', '07:00', tz, new Date('2026-05-23T07:00:00Z'))).toBe(false);
    // mid-day — outside
    expect(isInQuietHours('22:00', '07:00', tz, new Date('2026-05-23T12:00:00Z'))).toBe(false);
    // exactly at start — inside
    expect(isInQuietHours('22:00', '07:00', tz, new Date('2026-05-23T22:00:00Z'))).toBe(true);
  });

  it('respects timezone for wall-clock comparison', () => {
    // 03:00 UTC = 22:00 America/Chicago (CDT, UTC-5); inside 22:00–07:00 CDT.
    const at03Utc = new Date('2026-05-23T03:00:00Z');
    expect(isInQuietHours('22:00', '07:00', 'America/Chicago', at03Utc)).toBe(true);
    // 18:00 UTC = 13:00 America/Chicago; outside.
    const at18Utc = new Date('2026-05-23T18:00:00Z');
    expect(isInQuietHours('22:00', '07:00', 'America/Chicago', at18Utc)).toBe(false);
  });
});

describe('humanRelative', () => {
  const tz = 'UTC';
  const ref = new Date('2026-05-23T12:00:00Z');

  it('returns "today" for same-day timestamps', () => {
    expect(humanRelative('2026-05-23T03:00:00Z', ref, tz)).toBe('today');
    expect(humanRelative('2026-05-23T23:00:00Z', ref, tz)).toBe('today');
  });

  it('returns "yesterday" for one day prior', () => {
    expect(humanRelative('2026-05-22T12:00:00Z', ref, tz)).toBe('yesterday');
  });

  it('returns "Nd ago" for days >= 2', () => {
    expect(humanRelative('2026-05-20T12:00:00Z', ref, tz)).toBe('3d ago');
    expect(humanRelative('2026-05-16T12:00:00Z', ref, tz)).toBe('7d ago');
  });

  it('returns "tomorrow" / "in Nd" for future dates', () => {
    expect(humanRelative('2026-05-24T12:00:00Z', ref, tz)).toBe('tomorrow');
    expect(humanRelative('2026-05-27T12:00:00Z', ref, tz)).toBe('in 4d');
  });
});
