import { getDb } from '@compass/db';
import type { EntityType } from '@compass/shared';
import type Database from 'better-sqlite3';
import type { IndexInput, SearchHit, SearchProvider } from './index.js';

export function createFts5Provider(): SearchProvider {
  return {
    async indexEntity(input: IndexInput): Promise<void> {
      const handle = getDb();
      if (handle.dialect !== 'sqlite') {
        throw new Error('FTS5 provider requires SQLite');
      }
      const raw = handle.raw as Database.Database;
      const tagsStr = input.tags.join(' ');
      raw
        .prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?')
        .run(input.entity_type, input.entity_id);
      raw
        .prepare(
          'INSERT INTO search_index (entity_type, entity_id, title, body, tags) VALUES (?, ?, ?, ?, ?)',
        )
        .run(input.entity_type, input.entity_id, input.title ?? '', input.body ?? '', tagsStr);
    },
    async removeEntity({ entity_type, entity_id }) {
      const handle = getDb();
      const raw = handle.raw as Database.Database;
      raw
        .prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?')
        .run(entity_type, entity_id);
    },
    async query({ q, types, tags, limit = 20 }): Promise<SearchHit[]> {
      const handle = getDb();
      const raw = handle.raw as Database.Database;
      const escapedQ = sanitizeFtsQuery(q);
      const params: unknown[] = [escapedQ];
      let typeFilter = '';
      if (types && types.length > 0) {
        typeFilter = ` AND entity_type IN (${types.map(() => '?').join(',')})`;
        params.push(...types);
      }
      let tagFilter = '';
      if (tags && tags.length > 0) {
        // OR-match on tags via additional MATCH against tags column. Each tag must be quoted
        // so multi-word or non-ASCII tags don't break FTS5 query parsing.
        tagFilter = ' AND tags MATCH ?';
        const quoted = tags
          .map((t) => t.replace(/["()*]/g, ' ').trim())
          .filter(Boolean)
          .map((t) => `"${t}"`);
        params.push(quoted.join(' OR '));
      }
      params.push(limit);
      const rows = raw
        .prepare(
          `SELECT entity_type, entity_id,
                  snippet(search_index, 2, '<mark>', '</mark>', '…', 16) AS title_snippet,
                  snippet(search_index, 3, '<mark>', '</mark>', '…', 24) AS body_snippet,
                  bm25(search_index) AS rank
           FROM search_index
           WHERE search_index MATCH ?${typeFilter}${tagFilter}
           ORDER BY bm25(search_index) LIMIT ?`,
        )
        .all(...params) as Array<{
        entity_type: EntityType;
        entity_id: string;
        title_snippet: string;
        body_snippet: string;
        rank: number;
      }>;
      return rows.map((r) => ({
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        title: r.title_snippet,
        snippet: r.body_snippet,
        rank: r.rank,
      }));
    },
  };
}

// FTS5 has restricted query syntax; escape user input by quoting tokens.
function sanitizeFtsQuery(q: string): string {
  const tokens = q
    .replace(/["()*]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return '""';
  return tokens.map((t) => `"${t}"`).join(' ');
}
