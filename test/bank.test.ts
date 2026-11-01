import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clearStale, metaProblems, parseHints } from '../src/bank.js';
import { tempDir } from './helpers.js';

describe('parseHints', () => {
  it('splits on "## " headings', () => {
    expect(parseHints('## Hint 1\nnudge\n\n## Hint 2\napproach\n\n## Hint 3\nnear answer\n')).toEqual([
      'nudge',
      'approach',
      'near answer',
    ]);
  });

  it('keeps a "###" subheading inside its hint', () => {
    const hints = parseHints('## Hint 1\nnudge\n\n### Example\ncode\n\n## Hint 2\napproach\n\n## Hint 3\nnear answer\n');
    expect(hints).toHaveLength(3);
    expect(hints[0]).toBe('nudge\n\n### Example\ncode');
  });

  it('ignores text before the first heading', () => {
    expect(parseHints('# Hints\n\n## Hint 1\nnudge\n')).toEqual(['nudge']);
  });
});

describe('metaProblems', () => {
  const base = { id: 'demo', title: 'Demo', track: 'ts-backend', type: 'extend', level: 2, estimateMinutes: 10, concepts: [] };

  it('accepts existingTests under tests/', () => {
    expect(metaProblems({ ...base, existingTests: ['tests/a.test.ts'] })).toEqual([]);
  });

  it.each([[[42]], [['src/a.test.ts']], [['tests/../a.test.ts']], ['tests/a.test.ts']])('rejects existingTests %j', (existingTests) => {
    expect(metaProblems({ ...base, existingTests })).toContain('existingTests must be paths under tests/ with no ..');
  });
});

describe('clearStale', () => {
  it('removes entries older than an hour and keeps fresh ones', () => {
    const root = tempDir('stale');
    const staging = path.join(root, 'staging');
    mkdirSync(path.join(staging, 'old'), { recursive: true });
    mkdirSync(path.join(staging, 'fresh'), { recursive: true });
    writeFileSync(path.join(staging, 'old', 'meta.json'), '{}');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(path.join(staging, 'old'), twoHoursAgo, twoHoursAgo);

    clearStale([staging, path.join(root, 'missing')]);
    expect(existsSync(path.join(staging, 'old'))).toBe(false);
    expect(existsSync(path.join(staging, 'fresh'))).toBe(true);
  });
});
