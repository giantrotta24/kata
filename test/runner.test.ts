import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeProject, DockerRunner, parseVitestReport, type ExecResult } from '../src/runner.js';
import { tempDir } from './helpers.js';

type Behavior = 'report' | 'no-report' | 'timeout';

// Records every docker call. The `run` call writes a passing report into the
// mounted out dir, writes nothing, or times out.
function fakeDocker(behavior: Behavior) {
  const calls: string[][] = [];
  const exec = async (_command: string, args: string[]): Promise<ExecResult> => {
    calls.push(args);
    if (args.includes('run') && behavior === 'report') {
      const outDir = args[args.findIndex((arg) => arg.endsWith(':/opt/runner/out'))].split(':')[0];
      const report = { success: true, testResults: [{ status: 'passed', assertionResults: [{ fullName: 'works', status: 'passed' }] }] };
      writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(report));
    }
    return { code: 0, stdout: '', stderr: '', timedOut: args.includes('run') && behavior === 'timeout' };
  };
  return { calls, exec };
}

function projectOf(args: string[]): string {
  return args[args.indexOf('-p') + 1];
}

async function runWith(behavior: Behavior, track: 'sql' | 'ts-backend' = 'sql') {
  const root = tempDir('runner');
  mkdirSync(path.join(root, 'src'));
  mkdirSync(path.join(root, 'tests'));
  const docker = fakeDocker(behavior);
  const runner = new DockerRunner(path.join(root, 'runs'), 'compose.yml', docker.exec);
  const outcome = await runner
    .run({ track, srcDir: path.join(root, 'src'), testsDir: path.join(root, 'tests') })
    .then((result) => ({ result }), (error: Error) => ({ error }));
  return { ...docker, outcome };
}

describe('DockerRunner compose project', () => {
  it('lowercases the project name', () => {
    expect(composeProject('/home/.kata/runs/out-AbC123')).toBe('kata-out-abc123');
  });

  it('gives two runs different project names', async () => {
    const first = await runWith('report');
    const second = await runWith('report');
    expect(projectOf(first.calls[0])).not.toBe(projectOf(second.calls[0]));
  });

  it('tears its own project down after a passing run, for every track', async () => {
    for (const track of ['sql', 'ts-backend'] as const) {
      const { calls, outcome } = await runWith('report', track);
      expect(outcome).toMatchObject({ result: { passed: true } });
      const project = projectOf(calls[0]);
      expect(calls.at(-1)).toEqual(['compose', '-f', 'compose.yml', '-p', project, 'down', '--remove-orphans']);
      expect(calls.some((args) => args.includes('stop'))).toBe(false);
    }
  });

  it('tears down after a run that produced no report', async () => {
    const { calls, outcome } = await runWith('no-report');
    expect(outcome).toMatchObject({ error: { message: expect.stringMatching(/no test report/) } });
    expect(calls.at(-1)).toEqual(['compose', '-f', 'compose.yml', '-p', projectOf(calls[0]), 'down', '--remove-orphans']);
  });

  it('removes the runner container and tears down after a timeout', async () => {
    const { calls, outcome } = await runWith('timeout');
    expect(outcome).toMatchObject({ result: { passed: false, timedOut: true } });
    const container = calls[0][calls[0].indexOf('--name') + 1];
    expect(calls.slice(1)).toEqual([
      ['rm', '-f', container],
      ['compose', '-f', 'compose.yml', '-p', projectOf(calls[0]), 'down', '--remove-orphans'],
    ]);
  });
});

describe('parseVitestReport', () => {
  it('fails a file error with no assertions', () => {
    const result = parseVitestReport({
      success: false,
      testResults: [{ name: '/opt/runner/work/tests/math.test.ts', status: 'failed', message: 'Cannot find module ../src/math', assertionResults: [] }],
    });
    expect(result).toEqual({ passed: false, tests: [], errors: ['math.test.ts: Cannot find module ../src/math'] });
  });

  it('counts a skipped test as not passed', () => {
    const result = parseVitestReport({
      success: true,
      testResults: [
        {
          status: 'passed',
          assertionResults: [
            { fullName: 'adds', status: 'passed' },
            { fullName: 'subtracts', status: 'skipped' },
          ],
        },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.tests[1]).toEqual({ name: 'subtracts', passed: false, message: 'test skipped' });
  });

  it('fails a run with zero tests', () => {
    expect(parseVitestReport({ success: true, testResults: [] })).toEqual({ passed: false, tests: [], errors: [] });
  });

  it('turns a timed-out report into a failed run that says so', () => {
    const result = parseVitestReport({ success: false, timedOut: true, timeoutMs: 120_000 });
    expect(result).toMatchObject({ passed: false, tests: [], timedOut: true });
    expect(result.errors[0]).toMatch(/^timed out after 120 s/);
  });
});
