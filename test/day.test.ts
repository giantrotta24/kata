import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween } from '../src/day.js';

describe('dayKey', () => {
  it('belongs to the previous day before 03:00 local time', () => {
    expect(dayKey(new Date(2026, 10, 2, 0, 0))).toBe('2026-11-01');
    expect(dayKey(new Date(2026, 10, 2, 2, 59, 59))).toBe('2026-11-01');
  });

  it('starts the new day at exactly 03:00', () => {
    expect(dayKey(new Date(2026, 10, 2, 3, 0, 0))).toBe('2026-11-02');
    expect(dayKey(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
  });

  it('crosses month and year boundaries', () => {
    expect(dayKey(new Date(2027, 0, 1, 1, 0))).toBe('2026-12-31');
    expect(dayKey(new Date(2026, 11, 1, 2, 0))).toBe('2026-11-30');
  });
});

describe('day arithmetic', () => {
  it('adds and measures days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7);
  });
});
