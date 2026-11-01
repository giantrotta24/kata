import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { admit, validateChallenge } from '../src/validate.js';
import { FAIL, PASS, ScriptedRunner, suite, tempDir, writeChallenge } from './helpers.js';

function challenge(meta?: Record<string, unknown> | null): { dir: string; runs: string } {
  const root = tempDir('validate');
  return { dir: writeChallenge(path.join(root, 'demo'), meta), runs: path.join(root, 'runs') };
}

describe('validateChallenge', () => {
  it('admits a challenge that passes every check', async () => {
    const { dir, runs } = challenge({ type: 'extend', existingTests: ['tests/existing.test.ts'] });
    const runner = new ScriptedRunner([PASS, FAIL, PASS, PASS]);
    expect(await validateChallenge(dir, runner, runs)).toEqual({ id: 'demo', admitted: true });
    expect(runner.requests.at(-1)?.only).toEqual(['tests/existing.test.ts']);
  });

  it('rejects at check 1 when the reference fails', async () => {
    const { dir, runs } = challenge();
    expect(await validateChallenge(dir, new ScriptedRunner([FAIL]), runs)).toMatchObject({ admitted: false, check: 'reference-passes' });
  });

  it('rejects at check 2 when the starter passes', async () => {
    const { dir, runs } = challenge();
    expect(await validateChallenge(dir, new ScriptedRunner([PASS, PASS]), runs)).toMatchObject({ admitted: false, check: 'starter-fails' });
  });

  it('rejects at check 2 when the starter run has only errors and no failing test', async () => {
    const { dir, runs } = challenge();
    const collectError = suite([], ['index.test.ts: Cannot find module ../src/index']);
    const verdict = await validateChallenge(dir, new ScriptedRunner([PASS, collectError]), runs);
    expect(verdict).toMatchObject({ admitted: false, check: 'starter-fails' });
    expect(verdict.detail).toMatch(/no test failed/);
  });

  it('rejects at check 3 when the second reference run fails', async () => {
    const { dir, runs } = challenge();
    expect(await validateChallenge(dir, new ScriptedRunner([PASS, FAIL, FAIL]), runs)).toMatchObject({ admitted: false, check: 'reference-stable' });
  });

  it('rejects at check 4 when the starter fails the existing suite', async () => {
    const { dir, runs } = challenge({ type: 'extend', existingTests: ['tests/existing.test.ts'] });
    const verdict = await validateChallenge(dir, new ScriptedRunner([PASS, FAIL, PASS, FAIL]), runs);
    expect(verdict).toMatchObject({ admitted: false, check: 'extend-suite' });
  });

  it.each([
    ['reference-passes', [new Error('no test report')]],
    ['starter-fails', [PASS, new Error('no test report')]],
    ['reference-stable', [PASS, FAIL, new Error('no test report')]],
    ['extend-suite', [PASS, FAIL, PASS, new Error('no test report')]],
  ] as const)('turns a runner error during %s into a rejection at that check', async (check, script) => {
    const { dir, runs } = challenge({ type: 'extend', existingTests: ['tests/existing.test.ts'] });
    const verdict = await validateChallenge(dir, new ScriptedRunner([...script]), runs);
    expect(verdict).toMatchObject({ admitted: false, check });
    expect(verdict.detail).toBe('runner error: no test report');
  });

  it('rejects a null meta.json without throwing', async () => {
    const { dir, runs } = challenge(null);
    const verdict = await validateChallenge(dir, new ScriptedRunner([]), runs);
    expect(verdict).toMatchObject({ id: 'demo', admitted: false, check: 'structure', detail: 'meta.json is not an object' });
  });

  it('rejects existingTests entries that are not strings without throwing', async () => {
    const { dir, runs } = challenge({ type: 'extend', existingTests: [42] });
    expect(await validateChallenge(dir, new ScriptedRunner([]), runs)).toMatchObject({ admitted: false, check: 'structure' });
  });

  it('rejects existingTests entries that leave tests/', async () => {
    const { dir, runs } = challenge({ type: 'extend', existingTests: ['tests/../starter/index.ts'] });
    const verdict = await validateChallenge(dir, new ScriptedRunner([]), runs);
    expect(verdict).toMatchObject({ admitted: false, check: 'structure' });
    expect(verdict.detail).toMatch(/no \.\./);
  });
});

describe('admit', () => {
  it('deletes solution/ before the challenge reaches the bank', () => {
    const { dir } = challenge();
    const bank = path.join(path.dirname(dir), 'bank');
    mkdirSync(path.join(bank, 'demo'), { recursive: true });
    writeFileSync(path.join(bank, 'demo', 'occupied'), '');
    expect(() => admit(dir, bank, 'demo')).toThrow();
    expect(existsSync(path.join(dir, 'solution'))).toBe(false);
  });

  it('moves the challenge into the bank without its solution', () => {
    const { dir } = challenge();
    const bank = path.join(path.dirname(dir), 'bank');
    admit(dir, bank, 'demo');
    expect(existsSync(path.join(bank, 'demo', 'meta.json'))).toBe(true);
    expect(existsSync(path.join(bank, 'demo', 'solution'))).toBe(false);
  });
});
