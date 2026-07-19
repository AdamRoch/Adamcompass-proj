import { getDb } from '@compass/db';
import type { EntityType } from '@compass/shared';
import type postgres from 'postgres';
import type { IndexInput, SearchHit, SearchProvider } from './index.js';

export function createTsvectorProvider(): SearchProvider {
  return {
    async indexEntity(input: IndexInput): Promise<void> {
      const handle = getDb();
      if (handle.dialect !== 'pg') throw new Error('tsvector provider requires Postgres');
      const sql = handle.raw as ReturnType<typeof postgres>;
      const tagsStr = input.tags.join(' ');
      await sql`
        INSERT INTO search_index (entity_type, entity_id, title, body, tags)
        VALUES (${input.entity_type}, ${input.entity_id}, ${input.title ?? ''}, ${input.body ?? ''}, ${tagsStr})
        ON CONFLICT (entity_type, entity_id)
        DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, tags = EXCLUDED.tags
      `;
    },
    async removeEntity({ entity_type, entity_id }) {
      const handle = getDb();
      const sql = handle.raw as ReturnType<typeof postgres>;
      await sql`DELETE FROM search_index WHERE entity_type = ${entity_type} AND entity_id = ${entity_id}`;
    },
    async query({ q, types, tags, limit = 20 }): Promise<SearchHit[]> {
      // Guard against empty/whitespace-only queries — plainto_tsquery('') returns an empty
      // query that matches nothing useful, and we don't want to take a DB round-trip for it.
      const trimmedQ = (q ?? '').trim();
      if (!trimmedQ) return [];
      const handle = getDb();
      const sql = handle.raw as ReturnType<typeof postgres>;
      const typeFilter =
        types && types.length > 0
          ? sql`AND entity_type = ANY(${types as unknown as string[]})`
          : sql``;
      const tagFilter =
        tags && tags.length > 0
          ? sql`AND tsv @@ plainto_tsquery('english', ${tags.join(' ')})`
          : sql``;
      const rows = await sql<
        Array<{
          entity_type: EntityType;
          entity_id: string;
          title_snippet: string;
          body_snippet: string;
          rank: number;
        }>
      >`
        SELECT entity_type,
               entity_id,
               ts_headline('english', title, plainto_tsquery('english', ${trimmedQ}),
                 'MaxFragments=1,MaxWords=8,MinWords=3,StartSel=<mark>,StopSel=</mark>') AS title_snippet,
               ts_headline('english', body, plainto_tsquery('english', ${trimmedQ}),
                 'MaxFragments=2,MaxWords=12,MinWords=5,StartSel=<mark>,StopSel=</mark>') AS body_snippet,
               ts_rank(tsv, plainto_tsquery('english', ${trimmedQ})) AS rank
        FROM search_index
        WHERE tsv @@ plainto_tsquery('english', ${trimmedQ})
        ${typeFilter}
        ${tagFilter}
        ORDER BY rank DESC
        LIMIT ${limit}
      `;
      return rows.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        title: r.title_snippet ?? '',
        snippet: r.body_snippet ?? '',
        rank: r.rank,
      }));
    },
  };
}
