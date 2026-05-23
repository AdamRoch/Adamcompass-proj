import type { EntityType } from '@compass/shared';
import { getDb } from '@compass/db';
import { createFts5Provider } from './fts5.js';
import { createTsvectorProvider } from './tsvector.js';

export interface SearchHit {
  entity_type: EntityType;
  entity_id: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface IndexInput {
  entity_type: EntityType;
  entity_id: string;
  title: string;
  body: string;
  tags: string[];
}

export interface SearchProvider {
  indexEntity(input: IndexInput): Promise<void>;
  removeEntity(args: { entity_type: EntityType; entity_id: string }): Promise<void>;
  query(args: {
    q: string;
    types?: EntityType[];
    tags?: string[];
    limit?: number;
  }): Promise<SearchHit[]>;
}

let cached: SearchProvider | null = null;

export function getSearch(): SearchProvider {
  if (cached) return cached;
  const handle = getDb();
  cached = handle.dialect === 'sqlite' ? createFts5Provider() : createTsvectorProvider();
  return cached;
}

export function resetCachedSearch() {
  cached = null;
}

export { createFts5Provider, createTsvectorProvider };
