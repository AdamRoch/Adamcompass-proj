// Higher-level search-index helper used after every entity write.
// Lives here (in the app) to avoid a circular dep between @compass/db and @compass/search.

import 'server-only';
import * as learningQ from '@compass/db/queries/learning';
import * as notesQ from '@compass/db/queries/notes';
import * as projectsQ from '@compass/db/queries/projects';
import * as resourcesQ from '@compass/db/queries/resources';
import * as tagsQ from '@compass/db/queries/tags';
import { getSearch } from '@compass/search';
import type { EntityType } from '@compass/shared';

export async function indexProject(id: string) {
  const p = await projectsQ.getProject(id);
  if (!p) return;
  const tags = await tagsQ.tagsForEntity('project', id);
  await getSearch().indexEntity({
    entity_type: 'project',
    entity_id: id,
    title: p.title,
    body: [p.summary ?? '', p.body_markdown ?? ''].join('\n'),
    tags: tags.map((t) => t.name),
  });
}

export async function indexLearningGoal(id: string) {
  const g = await learningQ.getLearningGoal(id);
  if (!g) return;
  const tags = await tagsQ.tagsForEntity('learning_goal', id);
  await getSearch().indexEntity({
    entity_type: 'learning_goal',
    entity_id: id,
    title: g.title,
    body: [g.motivation ?? '', g.body_markdown ?? ''].join('\n'),
    tags: tags.map((t) => t.name),
  });
}

export async function indexNote(id: string) {
  const n = await notesQ.getNote(id);
  if (!n) return;
  const tags = await tagsQ.tagsForEntity('note', id);
  await getSearch().indexEntity({
    entity_type: 'note',
    entity_id: id,
    title: n.title ?? '',
    body: n.body_markdown,
    tags: tags.map((t) => t.name),
  });
}

export async function indexResource(id: string) {
  const r = await resourcesQ.get(id);
  if (!r) return;
  await getSearch().indexEntity({
    entity_type: 'resource',
    entity_id: id,
    title: r.title,
    body: [r.author_source ?? '', r.url ?? ''].join(' '),
    tags: [r.kind, r.reading_status],
  });
}

export async function removeFromIndex(type: EntityType, id: string) {
  await getSearch().removeEntity({ entity_type: type, entity_id: id });
}

/** Re-index one entity by type — used after tag rename/merge so FTS tag terms stay fresh. */
export async function reindexEntity(type: string, id: string) {
  switch (type) {
    case 'project':
      return indexProject(id);
    case 'learning_goal':
      return indexLearningGoal(id);
    case 'note':
      return indexNote(id);
    case 'resource':
      return indexResource(id);
    default:
      return; // milestones/checklist/build runs aren't in the search index
  }
}
