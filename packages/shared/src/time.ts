// Timezone-aware "days ago" math and ISO helpers.
// Compass stores all timestamps as ISO-8601 UTC strings. Display + window math uses a single
// user-local TZ from settings (default America/Chicago).

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoToDate(iso: string): Date {
  return new Date(iso);
}

export function dateToIso(d: Date): string {
  return d.toISOString();
}

export function daysAgoIso(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function addDaysIso(iso: string, days: number): string {
  const d = isoToDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// "Days between" using calendar days in a given timezone.
export function calendarDaysBetween(a: string, b: string, tz: string): number {
  const aDate = startOfDayInTz(a, tz);
  const bDate = startOfDayInTz(b, tz);
  const diffMs = bDate.getTime() - aDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function startOfDayInTz(iso: string, tz: string): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

// Resolve "HH:MM" in a given TZ on a given UTC instant to a UTC ISO string for that wall time today.
export function resolveLocalTimeToday(
  timeHHMM: string,
  tz: string,
  ref: Date = new Date(),
): string {
  const [hStr, mStr] = timeHHMM.split(':');
  const h = Number(hStr ?? '0');
  const m = Number(mStr ?? '0');
  // Get today's Y/M/D in the user's TZ
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(ref);
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? 1970);
  const mo = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  // Use Intl trick: format a UTC date with timezone offset to find the offset for that instant.
  return localToUtcIso(y, mo, d, h, m, tz);
}

function localToUtcIso(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): string {
  // Iterate to converge on the right UTC instant whose wall time in tz matches (y,mo,d,h,mi).
  // For most TZs this converges in 1–2 iterations.
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const wall = wallTimeInTz(new Date(guess), tz);
    const wallMs = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi);
    const target = Date.UTC(y, mo - 1, d, h, mi);
    const drift = target - wallMs;
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess).toISOString();
}

function wallTimeInTz(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = fmt.formatToParts(date);
  return {
    y: Number(p.find((x) => x.type === 'year')?.value ?? 1970),
    mo: Number(p.find((x) => x.type === 'month')?.value ?? 1),
    d: Number(p.find((x) => x.type === 'day')?.value ?? 1),
    h: Number(p.find((x) => x.type === 'hour')?.value?.replace('24', '00') ?? 0),
    mi: Number(p.find((x) => x.type === 'minute')?.value ?? 0),
  };
}

// Is `now` inside [start..end] where start/end are "HH:MM" in tz; if end < start it wraps midnight.
export function isInQuietHours(
  startHHMM: string,
  endHHMM: string,
  tz: string,
  now: Date = new Date(),
): boolean {
  const w = wallTimeInTz(now, tz);
  const cur = w.h * 60 + w.mi;
  const [sH, sM] = startHHMM.split(':').map(Number);
  const [eH, eM] = endHHMM.split(':').map(Number);
  const s = (sH ?? 0) * 60 + (sM ?? 0);
  const e = (eH ?? 0) * 60 + (eM ?? 0);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e; // wraps midnight
}

// Format short relative time, e.g. "3d ago", "just now", "in 2d".
export function humanRelative(iso: string, ref: Date = new Date(), tz = 'America/Chicago'): string {
  const days = calendarDaysBetween(iso, ref.toISOString(), tz);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1) return `${days}d ago`;
  if (days === -1) return 'tomorrow';
  return `in ${Math.abs(days)}d`;
}
