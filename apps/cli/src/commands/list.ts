// `compass list` — show last N captures, recent projects, recent goals.

import { CompassApiError, CompassClient } from '@compass/api-client';
import type { LearningGoal, Note, Project } from '@compass/shared';
import { humanRelative } from '@compass/shared';
import Table from 'cli-table3';
import kleur from 'kleur';
import { resolveConfig, updateLastContact } from '../config.js';

export interface ListOptions {
  /** Number of items per section (default 10). */
  limit?: number;
}

export async function runList(opts: ListOptions): Promise<number> {
  const limit = clampLimit(opts.limit);
  const cfg = await resolveConfig({ requireToken: true });
  const client = new CompassClient({ baseUrl: cfg.baseUrl, token: cfg.token });

  const [inbox, projects, goals] = await Promise.all([
    safe(() => client.inbox()),
    safe(() => client.listProjects({ limit })),
    safe(() => client.listLearningGoals()),
  ]);

  if (inbox.ok || projects.ok || goals.ok) {
    await updateLastContact(new Date().toISOString());
  }

  if (!inbox.ok && !projects.ok && !goals.ok) {
    // Total failure — show the most informative error.
    const err = inbox.err ?? projects.err ?? goals.err;
    printFatal('list failed', err);
    return 1;
  }

  printCaptures(inbox.ok ? inbox.value.notes.slice(0, limit) : null, inbox.err);
  console.log('');
  printProjects(projects.ok ? projects.value.projects.slice(0, limit) : null, projects.err);
  console.log('');
  printGoals(goals.ok ? goals.value.learning_goals.slice(0, limit) : null, goals.err);

  return 0;
}

function printCaptures(notes: Note[] | null, err?: unknown): void {
  console.log(kleur.bold('Recent captures'));
  if (notes === null) {
    console.log(kleur.dim(`  (failed to load: ${describe(err)})`));
    return;
  }
  if (notes.length === 0) {
    console.log(kleur.dim('  inbox is empty.'));
    return;
  }
  const table = new Table({
    head: ['captured', 'type', 'body'],
    colWidths: [14, 13, 60],
    wordWrap: true,
    style: { head: ['dim'] },
  });
  for (const n of notes) {
    table.push([
      humanRelative(n.created_at),
      n.inbox_type_hint,
      truncate(stripNewlines(n.body_markdown), 200),
    ]);
  }
  console.log(table.toString());
}

function printProjects(projects: Project[] | null, err?: unknown): void {
  console.log(kleur.bold('Recent projects'));
  if (projects === null) {
    console.log(kleur.dim(`  (failed to load: ${describe(err)})`));
    return;
  }
  if (projects.length === 0) {
    console.log(kleur.dim('  no projects yet.'));
    return;
  }
  const sorted = [...projects].sort((a, b) => b.last_touched_at.localeCompare(a.last_touched_at));
  const table = new Table({
    head: ['touched', 'stage', 'title'],
    colWidths: [14, 12, 60],
    wordWrap: true,
    style: { head: ['dim'] },
  });
  for (const p of sorted) {
    table.push([humanRelative(p.last_touched_at), p.stage, truncate(p.title, 200)]);
  }
  console.log(table.toString());
}

function printGoals(goals: LearningGoal[] | null, err?: unknown): void {
  console.log(kleur.bold('Recent learning goals'));
  if (goals === null) {
    console.log(kleur.dim(`  (failed to load: ${describe(err)})`));
    return;
  }
  if (goals.length === 0) {
    console.log(kleur.dim('  no learning goals yet.'));
    return;
  }
  const sorted = [...goals].sort((a, b) => b.last_touched_at.localeCompare(a.last_touched_at));
  const table = new Table({
    head: ['touched', 'status', 'title'],
    colWidths: [14, 14, 60],
    wordWrap: true,
    style: { head: ['dim'] },
  });
  for (const g of sorted) {
    table.push([humanRelative(g.last_touched_at), g.status, truncate(g.title, 200)]);
  }
  console.log(table.toString());
}

function stripNewlines(s: string): string {
  return s.replace(/\s*\n+\s*/g, ' ').trim();
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function clampLimit(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw)) return 10;
  if (raw < 1) return 1;
  if (raw > 100) return 100;
  return Math.floor(raw);
}

interface Ok<T> {
  ok: true;
  value: T;
  err?: undefined;
}
interface Err {
  ok: false;
  value?: undefined;
  err: unknown;
}
type Result<T> = Ok<T> | Err;

async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, err };
  }
}

function describe(err: unknown): string {
  if (err instanceof CompassApiError) {
    const body = err.body as { error?: { message?: string } } | null;
    return body?.error?.message ?? `HTTP ${err.status}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function printFatal(prefix: string, err: unknown): void {
  console.error(`${kleur.red('error: ')}${prefix}: ${describe(err)}`);
  if (err instanceof CompassApiError && (err.status === 401 || err.status === 403)) {
    console.error(kleur.dim('Hint: run `compass login` first.'));
  }
}
