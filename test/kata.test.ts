import { existsSync, mkdirSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Kata } from '../src/kata.js';
import type { Runner } from '../src/runner.js';
import { addToBank, FAIL, FakeRunner, PASS, ScriptedRunner, tempDir, writeChallenge } from './helpers.js';

function setup(ids: string[] = ['alpha', 'bravo', 'charlie']) {
  const home = tempDir('home');
  for (const id of ids) addToBank(home, { id });
  let now = new Date(2026, 10, 1, 9, 0);
  const lines: string[] = [];
  const runner = new FakeRunner();
  const config = { workspaceDir: path.join(home, 'workspaces'), editorCommand: 'true', claudeBin: 'false' };
  const make = (cwd: string, kataRunner: Runner = runner) =>
    new Kata({ home, config, runner: kataRunner, now: () => now, log: (line) => lines.push(line), cwd, openEditor: () => {} });
  return {
    home,
    kata: make(home),
    lines,
    runner,
    // Another Kata on the same home, run from a different directory or runner.
    from: make,
    setNow: (date: Date) => (now = date),
    solve: (workspace: string) => writeFileSync(path.join(workspace, 'starter', 'SOLVED'), ''),
  };
}

function countedDays(kata: Kata): unknown[] {
  return kata.db.prepare('SELECT day FROM days WHERE counted = 1').all();
}

function makeStale(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  utimesSync(dir, twoHoursAgo, twoHoursAgo);
  return dir;
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

  it('counts a carried-over daily for the day it passes', async () => {
    const { kata, setNow, solve } = setup();
    const daily = kata.today({ open: false });
    setNow(new Date(2026, 10, 2, 9, 0));
    solve(daily.workspace);
    await kata.submit();
    expect(countedDays(kata)).toEqual([{ day: '2026-11-02' }]);
  });

  it('reads the time before grading, so a run that crosses 03:00 counts for the day it was submitted', async () => {
    const { kata, runner, setNow, solve } = setup();
    const daily = kata.today({ open: false });
    setNow(new Date(2026, 10, 2, 2, 50));
    runner.onRun = () => setNow(new Date(2026, 10, 2, 3, 10));
    solve(daily.workspace);
    await kata.submit();
    expect(countedDays(kata)).toEqual([{ day: '2026-11-01' }]);
    expect(kata.db.prepare('SELECT day FROM assignments WHERE id = ?').get(daily.id)).toEqual({ day: '2026-11-01' });
  });

  it('records a timed-out run as a failed submit and says it timed out', async () => {
    const { from, home, lines } = setup();
    const timedOut = { passed: false, tests: [], errors: ['timed out after 120 s'], runMs: 120_000, timedOut: true };
    const kata = from(home, new ScriptedRunner([timedOut]));
    kata.today({ open: false });
    expect((await kata.submit()).passed).toBe(false);
    expect(kata.db.prepare('SELECT passed FROM attempts').all()).toEqual([{ passed: 0 }]);
    expect(kata.db.prepare('SELECT failed_submits FROM assignments').get()).toEqual({ failed_submits: 1 });
    expect(lines).toContain('Timed out: the code never finished. Recorded as a failed submit.');
  });

  it('clears stale scratch entries under staging/ and runs/', async () => {
    const { kata, home } = setup();
    const staleStaging = makeStale(path.join(home, 'staging', 'generate-old'));
    const staleRun = makeStale(path.join(home, 'runs', 'submit-old'));
    const fresh = path.join(home, 'runs', 'submit-fresh');
    mkdirSync(fresh, { recursive: true });
    kata.today({ open: false });
    await kata.submit();
    expect(existsSync(staleStaging)).toBe(false);
    expect(existsSync(staleRun)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
  });
});

describe('current challenge', () => {
  it('falls back to the active daily, not a later extra, outside any workspace', () => {
    const { kata } = setup();
    const daily = kata.today({ open: false });
    kata.next({ open: false });
    kata.hint();
    expect(kata.db.prepare('SELECT id FROM assignments WHERE hints = 1').all()).toEqual([{ id: daily.id }]);
  });

  it('matches the workspace through a symlinked cwd', () => {
    const { kata, from, home } = setup();
    kata.today({ open: false });
    const extra = kata.next({ open: false });
    kata.next({ open: false });
    const link = path.join(home, 'link');
    symlinkSync(extra.workspace, link);
    from(path.join(link, 'starter')).hint();
    expect(kata.db.prepare('SELECT id FROM assignments WHERE hints = 1').all()).toEqual([{ id: extra.id }]);
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
    kata.flag({ yes: true });
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

  it('refuses outside a workspace unless --yes is passed', () => {
    const { kata, home } = setup();
    const daily = kata.today({ open: false });
    expect(() => kata.flag()).toThrow(/kata flag --yes/);
    expect(existsSync(path.join(home, 'bank', daily.challenge_id))).toBe(true);
  });

  it('flags without --yes from inside the workspace', () => {
    const { kata, from, home } = setup();
    const daily = kata.today({ open: false });
    from(path.join(daily.workspace, 'starter')).flag();
    expect(existsSync(path.join(home, 'bank', daily.challenge_id))).toBe(false);
  });

  it('carries a stale daily over and refunds today, not the day it started', () => {
    const { kata, setNow } = setup();
    kata.today({ open: false });
    setNow(new Date(2026, 10, 2, 9, 0));
    kata.flag({ yes: true });
    expect(kata.db.prepare('SELECT day FROM days WHERE refunded = 1').all()).toEqual([{ day: '2026-11-02' }]);
  });
});

describe('import', () => {
  it('rejects a challenge whose run errors and still validates the next one', async () => {
    const { from, home } = setup([]);
    const root = tempDir('import');
    const broken = writeChallenge(path.join(root, 'broken'));
    const good = writeChallenge(path.join(root, 'good'));
    const kata = from(home, new ScriptedRunner([new Error('The runner produced no test report (exit 1).'), PASS, FAIL, PASS]));
    const verdicts = await kata.import([broken, good]);
    expect(verdicts).toEqual([
      { id: 'broken', admitted: false, check: 'reference-passes', detail: 'runner error: The runner produced no test report (exit 1).' },
      { id: 'good', admitted: true },
    ]);
    expect(existsSync(path.join(home, 'bank', 'good'))).toBe(true);
    expect(existsSync(path.join(home, 'bank', 'good', 'solution'))).toBe(false);
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
