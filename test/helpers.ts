import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Runner, RunRequest, SuiteResult } from '../src/runner.js';
import type { ChallengeMeta, ChallengeType, Track } from '../src/types.js';

const TMP_ROOT = path.resolve(import.meta.dirname, '..', '.test-tmp');

export function tempDir(prefix: string): string {
  mkdirSync(TMP_ROOT, { recursive: true });
  return mkdtempSync(path.join(TMP_ROOT, `${prefix}-`));
}

// Passes when the submitted source contains a file named SOLVED.
export class FakeRunner implements Runner {
  readonly requests: RunRequest[] = [];

  async run(request: RunRequest): Promise<SuiteResult> {
    this.requests.push(request);
    const passed = existsSync(path.join(request.srcDir, 'SOLVED'));
    return { passed, tests: [{ name: 'works', passed, message: passed ? undefined : 'nope' }], errors: [], runMs: 5 };
  }
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
