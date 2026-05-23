import { monotonicFactory, ulid as plainUlid } from 'ulid';

const monotonic = monotonicFactory();

// Time-sortable ULID for server-side generation; guaranteed strictly increasing within a process
export function newUlid(seedTime?: number): string {
  return monotonic(seedTime);
}

// Non-monotonic ULID (use when client-side generation is required and ordering not critical)
export function clientUlid(): string {
  return plainUlid();
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isUlid(s: unknown): s is string {
  return typeof s === 'string' && ULID_RE.test(s);
}
