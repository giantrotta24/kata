import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from './home.js';
import { KataError, type Track } from './types.js';

export interface TestCase {
  name: string;
  passed: boolean;
  message?: string;
}

export interface SuiteResult {
  passed: boolean;
  tests: TestCase[];
  errors: string[];
  runMs: number;
}

export interface RunRequest {
  track: Track;
  srcDir: string;
  testsDir: string;
  only?: string[];
}

export interface Runner {
  run(request: RunRequest): Promise<SuiteResult>;
}

const RUN_TIMEOUT_MS = 180_000;
const CONTAINER_ROOT = '/opt/runner';

function firstLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

interface VitestAssertion {
  fullName?: string;
  title?: string;
  status?: string;
  failureMessages?: string[];
}

interface VitestReport {
  success?: boolean;
  testResults?: {
    name?: string;
    status?: string;
    message?: string;
    assertionResults?: VitestAssertion[];
  }[];
}

export function parseVitestReport(report: VitestReport): Omit<SuiteResult, 'runMs'> {
  const tests: TestCase[] = [];
  const errors: string[] = [];
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      const passed = assertion.status === 'passed';
      tests.push({
        name: assertion.fullName ?? assertion.title ?? 'unnamed test',
        passed,
        message: passed ? undefined : (firstLine(assertion.failureMessages?.[0]) ?? `test ${assertion.status}`),
      });
    }
    if (file.status === 'failed' && file.message) {
      errors.push(`${path.basename(file.name ?? 'test file')}: ${firstLine(file.message)}`);
    }
  }
  if (report.success === false && errors.length === 0 && tests.every((test) => test.passed)) {
    errors.push('the test run reported an error outside any test');
  }
  const passed = tests.length > 0 && errors.length === 0 && tests.every((test) => test.passed);
  return { passed, tests, errors };
}

interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function exec(command: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), RUN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new KataError(`Could not run ${command}: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function tail(text: string, lines = 15): string {
  return text.trim().split('\n').slice(-lines).join('\n');
}

export class DockerRunner implements Runner {
  constructor(
    private readonly runsDir: string,
    private readonly composeFile = path.join(PACKAGE_ROOT, 'docker-compose.yml'),
  ) {}

  async run(request: RunRequest): Promise<SuiteResult> {
    mkdirSync(this.runsDir, { recursive: true });
    const outDir = mkdtempSync(path.join(this.runsDir, 'out-'));
    const compose = ['compose', '-f', this.composeFile, '-p', 'kata'];
    const started = Date.now();
    try {
      const result = await exec('docker', [
        ...compose,
        'run',
        '--rm',
        '-T',
        ...(request.track === 'sql' ? [] : ['--no-deps']),
        '-v',
        `${path.resolve(request.srcDir)}:${CONTAINER_ROOT}/work/src`,
        '-v',
        `${path.resolve(request.testsDir)}:${CONTAINER_ROOT}/work/tests:ro`,
        '-v',
        `${outDir}:${CONTAINER_ROOT}/out`,
        '-e',
        `KATA_TRACK=${request.track}`,
        'runner',
        ...(request.only ?? []).map((file) => `work/${file}`),
      ]);
      if (request.track === 'sql') await exec('docker', [...compose, 'stop', 'postgres']);

      const reportFile = path.join(outDir, 'result.json');
      if (!existsSync(reportFile)) {
        throw new KataError(
          `The runner produced no test report (exit ${result.code}).\n${tail(result.stderr || result.stdout)}`,
        );
      }
      const report = JSON.parse(readFileSync(reportFile, 'utf8')) as VitestReport;
      return { ...parseVitestReport(report), runMs: Date.now() - started };
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }
}
