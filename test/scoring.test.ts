import { describe, expect, it } from 'vitest';
import { applyOutcome, passOutcome, xpFor } from '../src/scoring.js';

describe('xpFor', () => {
  it('scores the worked example: level 3, 2 failed submits, 1 hint', () => {
    expect(xpFor({ level: 3, failedSubmits: 2, hints: 1, assisted: false })).toBe(24);
  });

  it('adds 20% for a first-submit pass', () => {
    expect(xpFor({ level: 2, failedSubmits: 0, hints: 0, assisted: false })).toBe(24);
    expect(xpFor({ level: 5, failedSubmits: 0, hints: 0, assisted: false })).toBe(120);
  });

  it('takes 10% per failed submit', () => {
    expect(xpFor({ level: 2, failedSubmits: 1, hints: 0, assisted: false })).toBe(18);
    expect(xpFor({ level: 4, failedSubmits: 3, hints: 0, assisted: false })).toBe(51);
  });

  it('never drops below half from failures alone', () => {
    expect(xpFor({ level: 5, failedSubmits: 7, hints: 0, assisted: false })).toBe(50);
    expect(xpFor({ level: 5, failedSubmits: 30, hints: 0, assisted: false })).toBe(50);
  });

  it('takes 25% per hint on top of the failure floor', () => {
    expect(xpFor({ level: 5, failedSubmits: 30, hints: 1, assisted: false })).toBe(37);
    expect(xpFor({ level: 1, failedSubmits: 0, hints: 3, assisted: false })).toBe(5);
  });

  it('gives nothing for an assisted pass', () => {
    expect(xpFor({ level: 5, failedSubmits: 0, hints: 0, assisted: true })).toBe(0);
  });
});

describe('passOutcome', () => {
  it('is clean with at most one failed submit and no hints', () => {
    expect(passOutcome({ failedSubmits: 0, hints: 0 })).toBe('clean');
    expect(passOutcome({ failedSubmits: 1, hints: 0 })).toBe('clean');
  });

  it('is rough with two or more hints', () => {
    expect(passOutcome({ failedSubmits: 0, hints: 2 })).toBe('rough');
  });

  it('is neutral otherwise', () => {
    expect(passOutcome({ failedSubmits: 2, hints: 0 })).toBe('neutral');
    expect(passOutcome({ failedSubmits: 0, hints: 1 })).toBe('neutral');
  });
});

describe('applyOutcome', () => {
  it('levels up after three clean solves and resets both counters', () => {
    let progress = { level: 2, clean: 0, rough: 1 };
    progress = applyOutcome(progress, 'clean');
    progress = applyOutcome(progress, 'clean');
    expect(progress).toEqual({ level: 2, clean: 2, rough: 1 });
    expect(applyOutcome(progress, 'clean')).toEqual({ level: 3, clean: 0, rough: 0 });
  });

  it('levels down after two rough outcomes and resets both counters', () => {
    const progress = applyOutcome({ level: 3, clean: 2, rough: 0 }, 'rough');
    expect(progress).toEqual({ level: 3, clean: 2, rough: 1 });
    expect(applyOutcome(progress, 'rough')).toEqual({ level: 2, clean: 0, rough: 0 });
  });

  it('stays within levels 1 to 5', () => {
    expect(applyOutcome({ level: 5, clean: 2, rough: 0 }, 'clean').level).toBe(5);
    expect(applyOutcome({ level: 1, clean: 0, rough: 1 }, 'rough').level).toBe(1);
  });

  it('leaves neutral outcomes alone', () => {
    expect(applyOutcome({ level: 2, clean: 1, rough: 1 }, 'neutral')).toEqual({ level: 2, clean: 1, rough: 1 });
  });
});
