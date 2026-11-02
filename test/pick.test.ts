import { describe, expect, it } from 'vitest';
import { addDays } from '../src/day.js';
import { pickDaily, pickExtra, pickReroll, type PickState } from '../src/pick.js';
import { TRACKS, type ChallengeMeta, type ChallengeType, type Track } from '../src/types.js';

function challenge(track: Track, level: number, type: ChallengeType, n: number): ChallengeMeta {
  return {
    id: `${track}-${type}-l${level}-${n}`,
    title: `${track} ${type} ${n}`,
    track,
    type,
    level,
    estimateMinutes: 20,
    concepts: [],
  };
}

const BANK: ChallengeMeta[] = TRACKS.flatMap((track) =>
  [1, 2, 3, 4, 5].flatMap((level) =>
    (['build', 'debug', 'extend'] as const).flatMap((type) => [1, 2].map((n) => challenge(track, level, type, n))),
  ),
);

function state(overrides: Partial<PickState> = {}): PickState {
  return {
    levels: { 'ts-frontend': 2, 'ts-backend': 2, sql: 2 },
    lastPracticed: {},
    passedIds: new Set(),
    excludedIds: new Set(),
    recentTypes: [],
    ...overrides,
  };
}

describe('pickDaily', () => {
  it('is deterministic for the same date and state', () => {
    const first = pickDaily('2026-11-01', BANK, state());
    const again = pickDaily('2026-11-01', [...BANK].reverse(), state());
    expect(again).toEqual(first);
  });

  it('varies across dates', () => {
    const ids = new Set(
      Array.from({ length: 30 }, (_, i) => pickDaily(addDays('2026-11-01', i), BANK, state())?.challenge.id),
    );
    expect(ids.size).toBeGreaterThan(5);
  });

  it('leans toward the lowest-level track', () => {
    const levels = { 'ts-frontend': 3, 'ts-backend': 3, sql: 1 };
    const counts: Record<string, number> = { 'ts-frontend': 0, 'ts-backend': 0, sql: 0 };
    for (let i = 0; i < 300; i++) {
      const pick = pickDaily(addDays('2026-11-01', i), BANK, state({ levels }));
      counts[pick!.challenge.track] += 1;
    }
    expect(counts.sql).toBeGreaterThan(counts['ts-frontend'] + counts['ts-backend']);
  });

  it('leans toward the longest-neglected track when levels tie', () => {
    const counts: Record<string, number> = { 'ts-frontend': 0, 'ts-backend': 0, sql: 0 };
    for (let i = 0; i < 300; i++) {
      const day = addDays('2026-11-01', i);
      const lastPracticed = { 'ts-frontend': day, 'ts-backend': day, sql: addDays(day, -14) };
      counts[pickDaily(day, BANK, state({ lastPracticed }))!.challenge.track] += 1;
    }
    expect(counts.sql).toBeGreaterThan(counts['ts-frontend']);
    expect(counts.sql).toBeGreaterThan(counts['ts-backend']);
  });

  it('serves the track level, with roughly one stretch day in five', () => {
    let stretch = 0;
    for (let i = 0; i < 500; i++) {
      const pick = pickDaily(addDays('2026-11-01', i), BANK, state())!;
      expect(pick.challenge.level).toBe(pick.stretch ? 3 : 2);
      if (pick.stretch) stretch += 1;
    }
    expect(stretch).toBeGreaterThan(60);
    expect(stretch).toBeLessThan(140);
  });

  it('mixes challenge types', () => {
    const types = new Set(
      Array.from({ length: 30 }, (_, i) => pickDaily(addDays('2026-11-01', i), BANK, state())!.challenge.type),
    );
    expect(types).toEqual(new Set(['build', 'debug', 'extend']));
  });

  it('never re-serves a passed challenge', () => {
    const passedIds = new Set(BANK.filter((c) => c.id !== 'sql-debug-l2-1').map((c) => c.id));
    expect(pickDaily('2026-11-01', BANK, state({ passedIds }))?.challenge.id).toBe('sql-debug-l2-1');
  });

  it('returns null when nothing is eligible', () => {
    const passedIds = new Set(BANK.map((c) => c.id));
    expect(pickDaily('2026-11-01', BANK, state({ passedIds }))).toBeNull();
    expect(pickDaily('2026-11-01', [], state())).toBeNull();
  });
});

describe('pickReroll and pickExtra', () => {
  it('rerolls within the same track and level, excluding the current one', () => {
    const excludedIds = new Set(['sql-build-l2-1']);
    const pick = pickReroll('2026-11-01', BANK, state({ excludedIds }), 'sql', 2)!;
    expect(pick.track).toBe('sql');
    expect(pick.level).toBe(2);
    expect(pick.id).not.toBe('sql-build-l2-1');
  });

  it('honours extra filters', () => {
    const pick = pickExtra('2026-11-01', 0, BANK, state(), { track: 'ts-backend', level: 4 })!;
    expect(pick).toMatchObject({ track: 'ts-backend', level: 4 });
  });
});
