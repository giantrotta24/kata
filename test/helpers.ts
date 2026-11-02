import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Runner, RunRequest, SuiteResult } from '../src/runner.js';
import type { ChallengeMeta, ChallengeType, Track } from '../src/types.js';

const TMP_ROOT = path.resolve(import.meta.dirname, '..', '.test-tmp');

export function tempDir(prefix: string): string {
  mkdirSync(TMP_ROOT, { recursive: true });
  return mkdtempSync(path.join(TMP_ROOT, `${prefix}-`));
}

// Passes when the submitted source contains a file named SOLVED. onRun fires
// while the run is in flight.
export class FakeRunner implements Runner {
  readonly requests: RunRequest[] = [];
  onRun?: () => void;

  async run(request: RunRequest): Promise<SuiteResult> {
    this.requests.push(request);
    this.onRun?.();
    const passed = existsSync(path.join(request.srcDir, 'SOLVED'));
    return { passed, tests: [{ name: 'works', passed, message: passed ? undefined : 'nope' }], errors: [], runMs: 5 };
  }
}

export function suite(tests: { name: string; passed: boolean }[], errors: string[] = []): SuiteResult {
  const passed = tests.length > 0 && errors.length === 0 && tests.every((test) => test.passed);
  return { passed, tests, errors, runMs: 5 };
}

export const PASS = suite([{ name: 'works', passed: true }]);
export const FAIL = suite([{ name: 'works', passed: false }]);

// Returns one scripted result per call, in order. An Error is thrown instead.
export class ScriptedRunner implements Runner {
  readonly requests: RunRequest[] = [];

  constructor(private readonly script: (SuiteResult | Error)[]) {}

  async run(request: RunRequest): Promise<SuiteResult> {
    this.requests.push(request);
    const next = this.script[this.requests.length - 1];
    if (!next) throw new Error(`no scripted result for call ${this.requests.length}`);
    if (next instanceof Error) throw next;
    return next;
  }
}

// A challenge folder with solution/, ready for validation.
export function writeChallenge(dir: string, meta: Record<string, unknown> | null = {}): string {
  mkdirSync(path.join(dir, 'starter'), { recursive: true });
  mkdirSync(path.join(dir, 'solution'), { recursive: true });
  mkdirSync(path.join(dir, 'tests'), { recursive: true });
  const full = meta === null ? null : { id: path.basename(dir), title: 'A challenge', track: 'ts-backend', type: 'build', level: 2, estimateMinutes: 10, concepts: [], ...meta };
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(full));
  writeFileSync(path.join(dir, 'README.md'), '# A challenge\n');
  writeFileSync(path.join(dir, 'hints.md'), '## Hint 1\nnudge\n\n## Hint 2\napproach\n\n## Hint 3\nnear answer\n');
  writeFileSync(path.join(dir, 'starter', 'index.ts'), 'export {};\n');
  writeFileSync(path.join(dir, 'solution', 'SOLVED'), '');
  writeFileSync(path.join(dir, 'tests', 'index.test.ts'), '// hidden\n');
  writeFileSync(path.join(dir, 'tests', 'existing.test.ts'), '// hidden\n');
  return dir;
}

export function addToBank(
  home: string,
  { id, track = 'ts-backend', type = 'build', level = 2 }: { id: string; track?: Track; type?: ChallengeType; level?: number },
): void {
  const dir = path.join(home, 'bank', id);
  mkdirSync(path.join(dir, 'starter'), { recursive: true });
  mkdirSync(path.join(dir, 'tests'), { recursive: true });
  const meta: ChallengeMeta = { id, title: `Challenge ${id}`, track, type, level, estimateMinutes: 15, concepts: [] };
  writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(path.join(dir, 'README.md'), `# ${id}\n`);
  writeFileSync(path.join(dir, 'hints.md'), '## Hint 1\nnudge\n\n## Hint 2\napproach\n\n## Hint 3\nnear answer\n');
  writeFileSync(path.join(dir, 'starter', 'index.ts'), 'export {};\n');
  writeFileSync(path.join(dir, 'tests', 'index.test.ts'), '// hidden\n');
}
