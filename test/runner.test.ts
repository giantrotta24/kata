import { describe, expect, it } from 'vitest';
import { parseVitestReport } from '../src/runner.js';

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
