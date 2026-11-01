import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { copyDir, HINT_COUNT, isDir, metaProblems, parseHints } from './bank.js';
import type { Runner, SuiteResult } from './runner.js';
import type { ChallengeMeta } from './types.js';

export type Check = 'structure' | 'reference-passes' | 'starter-fails' | 'reference-stable' | 'extend-suite';

export const CHECK_LABELS: Record<Check, string> = {
  structure: 'structure: the folder is not a complete challenge',
  'reference-passes': 'check 1: the reference solution must pass every test',
  'starter-fails': 'check 2: the untouched starter must fail at least one test',
  'reference-stable': 'check 3: the reference must pass a second run (flaky)',
  'extend-suite': 'check 4: the starter must pass the pre-existing suite',
};

export interface Verdict {
  id: string;
  admitted: boolean;
  check?: Check;
  detail?: string;
}

function structureProblems(dir: string): { meta?: ChallengeMeta; problems: string[] } {
  const problems: string[] = [];
  for (const file of ['README.md', 'meta.json', 'hints.md']) {
    if (!existsSync(path.join(dir, file))) problems.push(`missing ${file}`);
  }
  for (const folder of ['starter', 'tests', 'solution']) {
    if (!isDir(path.join(dir, folder))) problems.push(`missing ${folder}/`);
  }
  if (problems.length > 0) return { problems };

  let meta: unknown;
  try {
    meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch {
    return { problems: ['meta.json is not valid JSON'] };
  }
  problems.push(...metaProblems(meta));
  const valid = meta as ChallengeMeta;

  const hints = parseHints(readFileSync(path.join(dir, 'hints.md'), 'utf8'));
  if (hints.length !== HINT_COUNT) problems.push(`hints.md must have ${HINT_COUNT} "## " sections, found ${hints.length}`);
  const testFiles = readdirSync(path.join(dir, 'tests'), { recursive: true }).map(String);
  if (!testFiles.some((file) => /\.test\.[cm]?[jt]sx?$/.test(file))) problems.push('tests/ has no *.test.* file');
  if (valid.track === 'sql' && !existsSync(path.join(dir, 'tests', 'seed.sql'))) problems.push('sql challenges need tests/seed.sql');
  for (const file of valid.existingTests ?? []) {
    if (!file.startsWith('tests/') || !existsSync(path.join(dir, file))) problems.push(`existingTests entry ${file} not found under tests/`);
  }
  return { meta: valid, problems };
}

function failures(result: SuiteResult): string {
  const failed = result.tests.filter((test) => !test.passed).map((test) => `${test.name}: ${test.message}`);
  return [...result.errors, ...failed].slice(0, 5).join('; ') || 'no tests ran';
}

// The reference is the starter with solution/ laid over it, so solution/ only
// holds the files the solver is expected to change or add.
export async function validateChallenge(dir: string, runner: Runner, runsDir: string): Promise<Verdict> {
  const fallbackId = path.basename(dir);
  const { meta, problems } = structureProblems(dir);
  if (!meta || problems.length > 0) {
    return { id: meta?.id ?? fallbackId, admitted: false, check: 'structure', detail: problems.join('; ') };
  }

  mkdirSync(runsDir, { recursive: true });
  const workRoot = mkdtempSync(path.join(runsDir, `validate-${meta.id}-`));
  try {
    const referenceDir = path.join(workRoot, 'reference');
    const starterDir = path.join(workRoot, 'starter');
    copyDir(path.join(dir, 'starter'), referenceDir);
    copyDir(path.join(dir, 'solution'), referenceDir);
    copyDir(path.join(dir, 'starter'), starterDir);
    const testsDir = path.join(dir, 'tests');
    const reject = (check: Check, detail: string): Verdict => ({ id: meta.id, admitted: false, check, detail });

    const first = await runner.run({ track: meta.track, srcDir: referenceDir, testsDir });
    if (!first.passed) return reject('reference-passes', failures(first));

    const starter = await runner.run({ track: meta.track, srcDir: starterDir, testsDir });
    if (starter.passed) return reject('starter-fails', `all ${starter.tests.length} tests pass on the starter`);

    const second = await runner.run({ track: meta.track, srcDir: referenceDir, testsDir });
    if (!second.passed) return reject('reference-stable', `second run failed: ${failures(second)}`);

    if (meta.type === 'extend') {
      const existing = await runner.run({ track: meta.track, srcDir: starterDir, testsDir, only: meta.existingTests });
      if (!existing.passed) return reject('extend-suite', failures(existing));
    }
    return { id: meta.id, admitted: true };
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
}

export function admit(stagedDir: string, bankDir: string, id: string): void {
  mkdirSync(bankDir, { recursive: true });
  const target = path.join(bankDir, id);
  renameSync(stagedDir, target);
  rmSync(path.join(target, 'solution'), { recursive: true, force: true });
}
