import { describe, expect, it } from 'vitest';
import { addDays } from '../src/day.js';
import { computeStreak, type DayRecord } from '../src/streak.js';

const START = '2026-11-01';

function days(pattern: string, start = START): DayRecord[] {
  return [...pattern].map((mark, index) => ({
    day: addDays(start, index),
    counted: mark === 'x',
    refunded: mark === 'r',
  }));
}

function lastDay(pattern: string): string {
  return addDays(START, pattern.length - 1);
}

describe('computeStreak', () => {
  it('starts with two freezes and no streak', () => {
    expect(computeStreak([], START)).toEqual({ streak: 0, longest: 0, freezes: 2, freezesUsed: 0 });
  });

  it('counts consecutive passed days', () => {
    const pattern = 'xxx';
    expect(computeStreak(days(pattern), lastDay(pattern)).streak).toBe(3);
  });

  it('does not break the streak for today while it is still in progress', () => {
    const pattern = 'xx.';
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 2, freezes: 2 });
  });

  it('earns a freeze for every 7 consecutive counted days', () => {
    const pattern = 'xxxxxxx';
    expect(computeStreak(days(pattern), lastDay(pattern)).freezes).toBe(3);
  });

  it('holds at most 3 freezes', () => {
    const pattern = 'x'.repeat(21);
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 21, freezes: 3 });
  });

  it('uses a freeze automatically on a missed day and keeps the streak', () => {
    const pattern = 'xx.x';
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 3, freezes: 1, freezesUsed: 1 });
  });

  it('resets the streak on a missed day with no freezes left', () => {
    const pattern = 'xx...x';
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 1, longest: 2, freezes: 0 });
  });

  it('treats a missed day the same whether or not a row exists for it', () => {
    const records = [
      { day: '2026-11-01', counted: true, refunded: false },
      { day: '2026-11-05', counted: true, refunded: false },
    ];
    expect(computeStreak(records, '2026-11-05')).toMatchObject({ streak: 1, freezes: 0, freezesUsed: 2 });
  });

  it('spends no freezes on days before the first counted day', () => {
    const pattern = '..x';
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 1, freezes: 2 });
  });

  it('treats a refunded (flagged) day as neutral', () => {
    const pattern = 'xxrx';
    expect(computeStreak(days(pattern), lastDay(pattern))).toMatchObject({ streak: 3, freezes: 2, freezesUsed: 0 });
  });
});
