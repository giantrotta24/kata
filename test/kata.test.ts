import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Kata } from '../src/kata.js';
import { addToBank, FakeRunner, tempDir } from './helpers.js';

function setup(ids: string[] = ['alpha', 'bravo', 'charlie']) {
  const home = tempDir('home');
  for (const id of ids) addToBank(home, { id });
  let now = new Date(2026, 10, 1, 9, 0);
  const lines: string[] = [];
  const runner = new FakeRunner();
  const kata = new Kata({
    home,
    config: { workspaceDir: path.join(home, 'workspaces'), editorCommand: 'true', claudeBin: 'false' },
    runner,
    now: () => now,
    log: (line) => lines.push(line),
    cwd: home,
    openEditor: () => {},
  });
  return {
    home,
    kata,
    lines,
    runner,
    setNow: (date: Date) => (now = date),
    solve: (workspace: string) => writeFileSync(path.join(workspace, 'starter', 'SOLVED'), ''),
  };
}

describe('today', () => {
  it('copies only the README and starter into the workspace', () => {
    const { kata } = setup();
    const daily = kata.today({ open: false });
    expect(readdirSync(daily.workspace).sort()).toEqual(['README.md', 'starter']);
    expect(path.basename(daily.workspace)).toBe(`2026-11-01-${daily.challenge_id}`);
  });

  it('returns the same challenge and workspace when run again the same day', () => {
    const { kata, setNow } = setup();
    const first = kata.today({ open: false });
    setNow(new Date(2026, 10, 2, 2, 30));
    const again = kata.today({ open: false });
    expect(again.id).toBe(first.id);
    expect(again.workspace).toBe(first.workspace);
  });

  it('carries an unfinished daily over to the next day', () => {
    const { kata, setNow } = setup();
    const first = kata.today({ open: false });
    setNow(new Date(2026, 10, 2, 9, 0));
    const next = kata.today({ open: false });
    expect(next.id).toBe(first.id);
    expect(next.day).toBe('2026-11-02');
  });

  it('says to generate when the bank is empty', () => {
    const { kata } = setup([]);
    expect(() => kata.today({ open: false })).toThrow(/kata generate/);
  });
});

describe('submit', () => {
  it('records a failed attempt, then scores a pass after one failure', async () => {
    const { kata, solve } = setup();
    const daily = kata.today({ open: false });
    expect((await kata.submit()).passed).toBe(false);
    solve(daily.workspace);
    const outcome = await kata.submit();
    expect(outcome).toMatchObject({ passed: true, xp: 18 });
    const attempts = kata.db.prepare('SELECT passed FROM attempts ORDER BY id').all();
    expect(attempts).toEqual([{ passed: 0 }, { passed: 1 }]);
  });

  it('gives no XP or level credit for an assisted pass but counts the day', async () => {
    const { kata, solve } = setup();
    const daily = kata.today({ open: false });
    solve(daily.workspace);
    expect((await kata.submit({ assisted: true })).xp).toBe(0);
    expect(kata.db.prepare(`SELECT clean FROM tracks WHERE track = 'ts-backend'`).get()).toEqual({ clean: 0 });
    expect(kata.db.prepare('SELECT counted FROM days').get()).toEqual({ counted: 1 });
  });
});

describe('reroll', () => {
  it('works once per day and counts the skip as rough', () => {
    const { kata } = setup();
    const first = kata.today({ open: false });
    const second = kata.reroll({ open: false });
    expect(second.challenge_id).not.toBe(first.challenge_id);
    expect(kata.today({ open: false }).id).toBe(second.id);
    expect(() => kata.reroll({ open: false })).toThrow(/already rerolled/);
    expect(kata.db.prepare(`SELECT rough FROM tracks WHERE track = 'ts-backend'`).get()).toEqual({ rough: 1 });
  });

  it('is available again the next day', () => {
    const { kata, setNow } = setup();
    kata.today({ open: false });
    kata.reroll({ open: false });
    setNow(new Date(2026, 10, 2, 9, 0));
    expect(() => kata.reroll({ open: false })).not.toThrow();
  });
});

describe('flag', () => {
  it('removes the challenge from the bank and refunds the streak day', async () => {
    const { kata, home, setNow, solve } = setup();
    const day1 = kata.today({ open: false });
    solve(day1.workspace);
    await kata.submit();

    setNow(new Date(2026, 10, 2, 9, 0));
    const day2 = kata.today({ open: false });
    kata.flag();
    expect(existsSync(path.join(home, 'bank', day2.challenge_id))).toBe(false);
    expect(kata.db.prepare(`SELECT refunded FROM days WHERE day = '2026-11-02'`).get()).toEqual({ refunded: 1 });

    setNow(new Date(2026, 10, 3, 9, 0));
    const day3 = kata.today({ open: false });
    expect(day3.challenge_id).not.toBe(day2.challenge_id);
    solve(day3.workspace);
    await kata.submit();

    const lines: string[] = [];
    new Kata({ home, config: kata.config, runner: new FakeRunner(), now: () => new Date(2026, 10, 3, 10, 0), log: (l) => lines.push(l) }).status();
    expect(lines).toContain('Streak: 2 days (longest 2)');
    expect(lines).toContain('Freezes: 2');
  });
});

describe('hint', () => {
  it('reveals hints in order and then runs out', () => {
    const { kata } = setup();
    kata.today({ open: false });
    expect(kata.hint()).toBe('nudge');
    expect(kata.hint()).toBe('approach');
    expect(kata.hint()).toBe('near answer');
    expect(kata.hint()).toBeUndefined();
  });
});
