import { beforeEach, describe, expect, it } from 'vitest';
import { setupTestDb } from '../../../../tests/helpers/db.js';
import * as capturesQ from '../queries/captures.js';
import * as learningQ from '../queries/learning.js';
import * as notesQ from '../queries/notes.js';

describe('curiosity promotion', () => {
  beforeEach(() => {
    setupTestDb();
  });

  it('promotes an unfiled curiosity into a goal and files the note onto it', async () => {
    const cap = await capturesQ.createCapture({
      idem_key: 'cur-1',
      client_id: 'test',
      body: 'quantum error correction\nwhy do stabilizer codes work?',
      type_hint: 'curiosity',
      tags: [],
    });

    const goal = await learningQ.promoteCuriosityNote(cap.note_id);
    expect(goal).not.toBeNull();
    expect(goal!.title).toBe('quantum error correction');
    expect(goal!.status).toBe('curious');
    expect(goal!.motivation).toContain('stabilizer codes');

    const note = await notesQ.getNote(cap.note_id);
    expect(note!.entity_type).toBe('learning_goal');
    expect(note!.entity_id).toBe(goal!.id);
  });

  it('refuses to promote an already-filed note', async () => {
    const cap = await capturesQ.createCapture({
      idem_key: 'cur-2',
      client_id: 'test',
      body: 'already filed',
      type_hint: 'curiosity',
      tags: [],
    });
    const first = await learningQ.promoteCuriosityNote(cap.note_id);
    expect(first).not.toBeNull();
    // Second promotion: the note now belongs to the goal → null, no duplicate goal.
    expect(await learningQ.promoteCuriosityNote(cap.note_id)).toBeNull();
    expect(await learningQ.listLearningGoals({ limit: 50 })).toHaveLength(1);
  });
});
