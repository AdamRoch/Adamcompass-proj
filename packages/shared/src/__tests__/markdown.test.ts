import { describe, expect, it } from 'vitest';
import { parseRequirementBullets } from '../markdown.js';

describe('parseRequirementBullets', () => {
  it('extracts bullets under ## Requirements and stops at the next heading', () => {
    const md = [
      '## Problem',
      '- not this one',
      '## Requirements',
      '- ship the auth flow',
      '* support webhooks',
      '',
      'prose lines are ignored',
      '## Scope',
      '- not this either',
    ].join('\n');
    expect(parseRequirementBullets(md)).toEqual(['ship the auth flow', 'support webhooks']);
  });

  it('is case-insensitive and tolerates indentation on the heading', () => {
    const md = '  ## requirements\n- one\n- two';
    expect(parseRequirementBullets(md)).toEqual(['one', 'two']);
  });

  it('returns [] when there is no requirements section', () => {
    expect(parseRequirementBullets('# Title\n- stray bullet')).toEqual([]);
    expect(parseRequirementBullets('')).toEqual([]);
  });
});
