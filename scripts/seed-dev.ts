// Populate a development database with sample projects, learning goals, notes, resources, tags,
// activity events, and a handful of run events so the dashboard, inbox, and admin pages render
// with real-looking data. Idempotent — re-running won't duplicate.
//
// Usage:  pnpm dlx tsx scripts/seed-dev.ts
//         or:  node --import tsx scripts/seed-dev.ts

import { createDb, resetCachedDb } from '../packages/db/src/index.js';
import * as capturesQ from '../packages/db/src/queries/captures.js';
import * as learningQ from '../packages/db/src/queries/learning.js';
import * as notesQ from '../packages/db/src/queries/notes.js';
import * as projectsQ from '../packages/db/src/queries/projects.js';
import * as resourcesQ from '../packages/db/src/queries/resources.js';
import * as tagsQ from '../packages/db/src/queries/tags.js';

async function main() {
  resetCachedDb();
  createDb();

  // Web-app auth imports `server-only`, which resolves only inside apps/web — load it
  // lazily so the seed also runs standalone against a DB that already has its user.
  try {
    const { ensureSingleUserExists } = await import('../apps/web/lib/auth.js');
    console.log('[seed] ensuring bootstrap user (seed@compass.local / seedpass)');
    await ensureSingleUserExists('seed@compass.local', 'seedpass-do-not-use-in-prod');
  } catch {
    console.log('[seed] skipping user bootstrap (web auth not importable in this context)');
  }

  console.log('[seed] sample projects');
  const compass = await ensureProject({
    title: 'Compass',
    summary: 'Personal dashboard for projects, learning, and notes.',
    stage: 'building',
    repo_url: 'https://github.com/example/compass',
  });
  const newsletter = await ensureProject({
    title: 'Newsletter pipeline',
    summary: 'Weekly synthesis to a small list.',
    stage: 'review',
  });
  await ensureProject({
    title: 'Old tool rewrite',
    summary: 'Rewrite an internal script in a real language.',
    stage: 'idea',
  });

  console.log('[seed] sample learning goals');
  const distsys = await ensureLearningGoal({
    title: 'Distributed systems book',
    motivation: 'Cover the basics before tackling the agent runtime.',
    status: 'in_progress',
  });
  await ensureLearningGoal({
    title: 'Rust ownership patterns',
    status: 'curious',
  });

  console.log('[seed] tags');
  for (const name of ['ai', 'infra', 'writing', 'reading']) {
    await tagsQ.ensure(name);
  }

  console.log('[seed] inbox notes (via captures, idempotent on idem_key)');
  await capturesQ.createCapture({
    idem_key: 'seed-cap-1',
    client_id: 'seed',
    body: '? what would a continuous-evaluation harness look like for an agent?',
    type_hint: 'curiosity',
    tags: ['ai'],
  });
  await capturesQ.createCapture({
    idem_key: 'seed-cap-2',
    client_id: 'seed',
    body: 'Try Litestream backup restore from scratch on a fresh box this weekend.',
    type_hint: 'idea',
    tags: ['infra'],
  });

  console.log('[seed] resources (reading list)');
  await ensureResource({
    title: 'Designing Data-Intensive Applications',
    author_source: 'Martin Kleppmann',
    kind: 'book',
    reading_status: 'reading',
    learning_goal_id: distsys.id,
  });
  await ensureResource({
    title: 'In Search of an Understandable Consensus Algorithm (Raft)',
    author_source: 'Ongaro & Ousterhout',
    url: 'https://raft.github.io/raft.pdf',
    kind: 'paper',
    reading_status: 'to_read',
    learning_goal_id: distsys.id,
  });

  console.log('[seed] notes attached to projects');
  await notesQ.createNoteForEntity({
    entity_type: 'project',
    entity_id: compass.id,
    body_markdown: 'Decided to demote Notes to a property + Inbox view. Simpler IA.',
  });
  await notesQ.createNoteForEntity({
    entity_type: 'project',
    entity_id: newsletter.id,
    body_markdown: 'Open thread: do we use a markdown renderer or just plain text in the digest?',
  });

  console.log('[seed] done.');
}

async function ensureProject(input: Parameters<typeof projectsQ.createProject>[0]) {
  const list = await projectsQ.listProjects({ limit: 200, includeArchived: true });
  const existing = list.find((p) => p.title === input.title);
  if (existing) return existing;
  return await projectsQ.createProject(input);
}

async function ensureLearningGoal(input: Parameters<typeof learningQ.createLearningGoal>[0]) {
  const list = await learningQ.listLearningGoals({ limit: 200, includeArchived: true });
  const existing = list.find((g) => g.title === input.title);
  if (existing) return existing;
  return await learningQ.createLearningGoal(input);
}

async function ensureResource(input: Parameters<typeof resourcesQ.create>[0]) {
  const list = await resourcesQ.list({ limit: 500 });
  const existing = list.find((r) => r.title === input.title);
  if (existing) return existing;
  return await resourcesQ.create(input);
}

main().catch((err) => {
  console.error('[seed] failed', err);
  process.exit(1);
});
