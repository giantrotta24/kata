import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { clearStale, copyDir, loadBank, parseHints, readMeta, subdirectories } from './bank.js';
import { openDb, type DB } from './db.js';
import { dayKey } from './day.js';
import { homePaths, loadConfig, PACKAGE_ROOT, type Config, type EditorCommand } from './home.js';
import { pickDaily, pickExtra, pickReroll, RECENT_TYPES_WINDOW, type PickState } from './pick.js';
import { DockerRunner, type Runner, type SuiteResult } from './runner.js';
import {
  applyOutcome,
  CLEAN_SOLVES_TO_LEVEL_UP,
  passOutcome,
  ROUGH_OUTCOMES_TO_LEVEL_DOWN,
  xpFor,
  type Outcome,
  type TrackProgress,
} from './scoring.js';
import { computeStreak } from './streak.js';
import { KataError, TRACKS, type ChallengeMeta, type ChallengeType, type Track } from './types.js';
import { admit, CHECK_LABELS, validateChallenge, type Verdict } from './validate.js';

export interface Assignment {
  id: number;
  day: string;
  origin_day: string;
  kind: 'daily' | 'extra';
  challenge_id: string;
  title: string;
  track: Track;
  type: ChallengeType;
  level: number;
  workspace: string;
  started_at: string;
  status: 'active' | 'passed' | 'skipped' | 'flagged';
  hints: number;
  failed_submits: number;
  assisted: number;
  xp: number;
  passed_at: string | null;
  duration_seconds: number | null;
}

interface DayRow {
  day: string;
  counted: number;
  refunded: number;
  rerolled: number;
}

export interface KataOptions {
  home: string;
  config?: Config;
  runner?: Runner;
  now?: () => Date;
  log?: (line: string) => void;
  cwd?: string;
  openEditor?: (command: EditorCommand, dir: string) => void;
}

interface Current {
  assignment: Assignment;
  inWorkspace: boolean;
}

export interface SubmitOutcome {
  passed: boolean;
  xp: number;
  result: SuiteResult;
}

const NO_CHALLENGES = 'Nothing eligible in the bank. Run `kata generate` to add challenges.';

export function editorArgv(command: EditorCommand, dir: string): string[] {
  const parts = typeof command === 'string' ? command.split(/\s+/).filter(Boolean) : command;
  return [...parts, dir];
}

function launchEditor(command: EditorCommand, dir: string): void {
  const [bin, ...args] = editorArgv(command, dir);
  const child = spawn(bin, args, { detached: true, stdio: 'ignore' });
  child.on('error', (error) => console.error(`Could not open the editor (${bin}): ${error.message}`));
  child.unref();
}

function realpathOr(target: string): string {
  try {
    return realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

export class Kata {
  readonly home: string;
  readonly config: Config;
  readonly paths: ReturnType<typeof homePaths>;
  private readonly runner: Runner;
  private readonly now: () => Date;
  private readonly log: (line: string) => void;
  private readonly cwd: string;
  private readonly openEditor: (command: EditorCommand, dir: string) => void;
  private connection?: DB;

  constructor(options: KataOptions) {
    this.home = options.home;
    this.paths = homePaths(this.home);
    this.config = options.config ?? loadConfig(this.home);
    this.runner = options.runner ?? new DockerRunner(this.paths.runs);
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? ((line) => console.log(line));
    this.cwd = options.cwd ?? process.cwd();
    this.openEditor = options.openEditor ?? launchEditor;
  }

  get db(): DB {
    if (!this.connection) {
      mkdirSync(this.home, { recursive: true });
      this.connection = openDb(this.paths.db);
    }
    return this.connection;
  }

  close(): void {
    this.connection?.close();
    this.connection = undefined;
  }

  day(): string {
    return dayKey(this.now());
  }

  // --- reading state -------------------------------------------------------

  private dailyFor(day: string): Assignment | undefined {
    return this.db
      .prepare(
        `SELECT * FROM assignments WHERE kind = 'daily' AND day = ? AND status IN ('active', 'passed')
         ORDER BY id DESC LIMIT 1`,
      )
      .get(day) as Assignment | undefined;
  }

  private unfinishedEarlierDaily(day: string): Assignment | undefined {
    return this.db
      .prepare(`SELECT * FROM assignments WHERE kind = 'daily' AND status = 'active' AND day < ? ORDER BY day DESC, id DESC LIMIT 1`)
      .get(day) as Assignment | undefined;
  }

  private carryOver(assignment: Assignment, day: string): Assignment {
    this.db.prepare('UPDATE assignments SET day = ? WHERE id = ?').run(day, assignment.id);
    this.ensureDay(day);
    return { ...assignment, day };
  }

  private ensureDay(day: string): DayRow {
    this.db.prepare('INSERT OR IGNORE INTO days (day) VALUES (?)').run(day);
    return this.db.prepare('SELECT * FROM days WHERE day = ?').get(day) as DayRow;
  }

  private trackProgress(track: Track): TrackProgress {
    return this.db.prepare('SELECT level, clean, rough FROM tracks WHERE track = ?').get(track) as TrackProgress;
  }

  // The challenge whose workspace holds the cwd, else the active daily, else the
  // most recently started one.
  private current(): Current | undefined {
    const active = this.db
      .prepare(`SELECT * FROM assignments WHERE status = 'active' ORDER BY started_at DESC, id DESC`)
      .all() as Assignment[];
    const cwd = realpathOr(this.cwd);
    const inside = active.find((a) => {
      const workspace = realpathOr(a.workspace);
      return cwd === workspace || cwd.startsWith(workspace + path.sep);
    });
    if (inside) return { assignment: inside, inWorkspace: true };
    const fallback = active.find((a) => a.kind === 'daily') ?? active[0];
    return fallback && { assignment: fallback, inWorkspace: false };
  }

  private requireCurrent(): Current {
    const current = this.current();
    if (!current) throw new KataError('No challenge in progress. Run `kata today`.');
    return current;
  }

  pickState(day: string): PickState {
    const levels = Object.fromEntries(TRACKS.map((track) => [track, this.trackProgress(track).level])) as Record<Track, number>;
    const lastPracticed = Object.fromEntries(
      (this.db.prepare(`SELECT track, MAX(day) AS day FROM assignments WHERE status = 'passed' GROUP BY track`).all() as {
        track: Track;
        day: string;
      }[]).map((row) => [row.track, row.day]),
    );
    const ids = (sql: string, ...params: string[]) =>
      new Set((this.db.prepare(sql).all(...params) as { challenge_id: string }[]).map((row) => row.challenge_id));
    const recentTypes = (
      this.db
        .prepare(`SELECT type FROM assignments WHERE kind = 'daily' AND day < ? ORDER BY day DESC, id DESC LIMIT ?`)
        .all(day, RECENT_TYPES_WINDOW) as { type: ChallengeType }[]
    ).map((row) => row.type);
    return {
      levels,
      lastPracticed,
      passedIds: ids(`SELECT challenge_id FROM assignments WHERE status = 'passed'`),
      excludedIds: ids(`SELECT challenge_id FROM assignments WHERE day = ? OR status = 'active'`, day),
      recentTypes,
    };
  }

  private bank(): ChallengeMeta[] {
    return loadBank(this.paths.bank);
  }

  // --- assigning ------------------------------------------------------------

  private assign(challenge: ChallengeMeta, day: string, kind: Assignment['kind']): Assignment {
    const source = path.join(this.paths.bank, challenge.id);
    const workspace = path.join(this.config.workspaceDir, `${day}-${challenge.id}`);
    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
      copyFileSync(path.join(source, 'README.md'), path.join(workspace, 'README.md'));
      copyDir(path.join(source, 'starter'), path.join(workspace, 'starter'));
    }
    const { lastInsertRowid } = this.db
      .prepare(
        `INSERT INTO assignments (day, origin_day, kind, challenge_id, title, track, type, level, workspace, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(day, day, kind, challenge.id, challenge.title, challenge.track, challenge.type, challenge.level, workspace, this.now().toISOString());
    this.ensureDay(day);
    return this.db.prepare('SELECT * FROM assignments WHERE id = ?').get(lastInsertRowid) as Assignment;
  }

  private describe(assignment: Assignment): void {
    this.log(`${assignment.title}  [${assignment.track} · ${assignment.type} · level ${assignment.level}]`);
    this.log(`Workspace: ${assignment.workspace}`);
  }

  private open(assignment: Assignment, open: boolean): void {
    if (open) this.openEditor(this.config.editorCommand, assignment.workspace);
  }

  today({ open = true }: { open?: boolean } = {}): Assignment {
    const day = this.day();
    let assignment = this.dailyFor(day);
    if (!assignment) {
      const earlier = this.unfinishedEarlierDaily(day);
      if (earlier) {
        assignment = this.carryOver(earlier, day);
        this.log(`Carried over from ${earlier.day}.`);
      }
    }
    if (!assignment) {
      const pick = pickDaily(day, this.bank(), this.pickState(day));
      if (!pick) throw new KataError(NO_CHALLENGES);
      assignment = this.assign(pick.challenge, day, 'daily');
      if (pick.stretch) this.log('Stretch day: one level above your track level.');
    }
    this.log(`Today's kata (${day}):`);
    this.describe(assignment);
    if (assignment.status === 'passed') {
      this.log(`Done: passed for ${assignment.xp} XP. Want more? Run \`kata next\`.`);
    } else {
      this.open(assignment, open);
    }
    return assignment;
  }

  next({ track, level, open = true }: { track?: Track; level?: number; open?: boolean } = {}): Assignment {
    const day = this.day();
    const { count } = this.db
      .prepare(`SELECT COUNT(*) AS count FROM assignments WHERE kind = 'extra' AND day = ?`)
      .get(day) as { count: number };
    const challenge = pickExtra(day, count, this.bank(), this.pickState(day), { track, level });
    if (!challenge) throw new KataError(NO_CHALLENGES);
    const assignment = this.assign(challenge, day, 'extra');
    this.log('Extra kata:');
    this.describe(assignment);
    this.open(assignment, open);
    return assignment;
  }

  // --- grading ----------------------------------------------------------------

  async submit({ assisted = false }: { assisted?: boolean } = {}): Promise<SubmitOutcome> {
    let { assignment } = this.requireCurrent();
    const challengeDir = path.join(this.paths.bank, assignment.challenge_id);
    if (!existsSync(challengeDir)) throw new KataError(`${assignment.challenge_id} is no longer in the bank.`);

    // The submit counts for the day it was made, however long grading takes.
    const now = this.now();
    this.clearScratch();
    mkdirSync(this.paths.runs, { recursive: true });
    const runDir = mkdtempSync(path.join(this.paths.runs, 'submit-'));
    let result: SuiteResult;
    try {
      const srcDir = path.join(runDir, 'src');
      copyDir(path.join(assignment.workspace, 'starter'), srcDir);
      this.log(`Grading ${assignment.challenge_id}…`);
      result = await this.runner.run({ track: assignment.track, srcDir, testsDir: path.join(challengeDir, 'tests') });
    } finally {
      rmSync(runDir, { recursive: true, force: true });
    }

    for (const test of result.tests) {
      this.log(`  ${test.passed ? 'PASS' : 'FAIL'}  ${test.name}${test.passed ? '' : `\n        ${test.message}`}`);
    }
    for (const error of result.errors) this.log(`  ERROR ${error}`);
    const passedCount = result.tests.filter((test) => test.passed).length;
    this.log(`${passedCount}/${result.tests.length} tests passed in ${(result.runMs / 1000).toFixed(1)}s.`);
    if (result.timedOut) this.log('Timed out: the code never finished. Recorded as a failed submit.');

    this.db
      .prepare(
        `INSERT INTO attempts (assignment_id, submitted_at, passed, assisted, tests_passed, tests_total, run_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(assignment.id, now.toISOString(), result.passed ? 1 : 0, assisted ? 1 : 0, passedCount, result.tests.length, result.runMs);

    if (!result.passed) {
      this.db.prepare('UPDATE assignments SET failed_submits = failed_submits + 1 WHERE id = ?').run(assignment.id);
      this.log(`Not yet. Failed submits: ${assignment.failed_submits + 1}.`);
      return { passed: false, xp: 0, result };
    }

    const today = dayKey(now);
    if (assignment.kind === 'daily' && assignment.day !== today) assignment = this.carryOver(assignment, today);
    const xp = xpFor({ level: assignment.level, failedSubmits: assignment.failed_submits, hints: assignment.hints, assisted });
    const durationSeconds = Math.round((now.getTime() - new Date(assignment.started_at).getTime()) / 1000);

    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE assignments SET status = 'passed', passed_at = ?, xp = ?, assisted = ?, duration_seconds = ? WHERE id = ?`,
        )
        .run(now.toISOString(), xp, assisted ? 1 : 0, durationSeconds, assignment.id);
      if (!assisted) {
        this.recordOutcome(assignment.track, passOutcome({ failedSubmits: assignment.failed_submits, hints: assignment.hints }));
      }
      if (assignment.kind === 'daily') {
        this.ensureDay(today);
        this.db.prepare('UPDATE days SET counted = 1 WHERE day = ?').run(today);
      }
    })();

    this.log(assisted ? 'Passed (assisted): streak kept, no XP.' : `Passed! +${xp} XP.`);
    this.log(`Time from start: ${Math.round(durationSeconds / 60)} min.`);
    return { passed: true, xp, result };
  }

  private recordOutcome(track: Track, outcome: Outcome): void {
    const before = this.trackProgress(track);
    const after = applyOutcome(before, outcome);
    this.db.prepare('UPDATE tracks SET level = ?, clean = ?, rough = ? WHERE track = ?').run(after.level, after.clean, after.rough, track);
    if (after.level > before.level) this.log(`${track} levelled up to ${after.level}.`);
    if (after.level < before.level) this.log(`${track} dropped to level ${after.level}.`);
  }

  // --- help, skipping, flagging -------------------------------------------------

  hint(): string | undefined {
    const { assignment } = this.requireCurrent();
    const hints = parseHints(readFileSync(path.join(this.paths.bank, assignment.challenge_id, 'hints.md'), 'utf8'));
    if (assignment.hints >= hints.length) {
      this.log('No hints left for this challenge.');
      return undefined;
    }
    const hint = hints[assignment.hints];
    this.db.prepare('UPDATE assignments SET hints = hints + 1 WHERE id = ?').run(assignment.id);
    this.log(`Hint ${assignment.hints + 1} of ${hints.length} (each costs 25% of the XP):`);
    this.log(hint);
    return hint;
  }

  reroll({ open = true }: { open?: boolean } = {}): Assignment {
    const day = this.day();
    let daily = this.dailyFor(day);
    if (!daily) {
      const earlier = this.unfinishedEarlierDaily(day);
      if (earlier) daily = this.carryOver(earlier, day);
    }
    if (!daily || daily.status !== 'active') throw new KataError('There is no unfinished daily to reroll.');
    if (this.ensureDay(day).rerolled) throw new KataError('You already rerolled today. One reroll per day.');

    const state = this.pickState(day);
    const replacement = pickReroll(day, this.bank(), state, daily.track, daily.level);
    if (!replacement) {
      throw new KataError(`No other ${daily.track} level ${daily.level} challenge in the bank. Run \`kata generate\`.`);
    }
    const current = daily;
    const assignment = this.db.transaction(() => {
      this.db.prepare(`UPDATE assignments SET status = 'skipped' WHERE id = ?`).run(current.id);
      this.recordOutcome(current.track, 'rough');
      this.db.prepare('UPDATE days SET rerolled = 1 WHERE day = ?').run(day);
      return this.assign(replacement, day, 'daily');
    })();
    this.log(`Rerolled away from ${current.title}. New daily:`);
    this.describe(assignment);
    this.open(assignment, open);
    return assignment;
  }

  flag({ yes = false }: { yes?: boolean } = {}): Assignment {
    const current = this.requireCurrent();
    if (!current.inWorkspace && !yes) {
      throw new KataError(
        `You're not inside a challenge workspace. Run \`kata flag\` from the workspace of the challenge to flag, ` +
          `or \`kata flag --yes\` to flag ${current.assignment.challenge_id} (${current.assignment.workspace}).`,
      );
    }
    const day = this.day();
    let { assignment } = current;
    if (assignment.kind === 'daily' && assignment.day !== day) assignment = this.carryOver(assignment, day);
    this.db.transaction(() => {
      this.db.prepare(`UPDATE assignments SET status = 'flagged' WHERE id = ?`).run(assignment.id);
      if (assignment.kind === 'daily') {
        this.ensureDay(assignment.day);
        this.db.prepare('UPDATE days SET refunded = 1 WHERE day = ?').run(assignment.day);
      }
    })();
    rmSync(path.join(this.paths.bank, assignment.challenge_id), { recursive: true, force: true });
    this.log(`Flagged ${assignment.challenge_id} as broken and removed it from the bank.`);
    if (assignment.kind === 'daily') this.log(`${assignment.day} is refunded. Run \`kata today\` for a new daily.`);
    return assignment;
  }

  // --- status -----------------------------------------------------------------

  status(): void {
    const day = this.day();
    const days = this.db.prepare('SELECT * FROM days').all() as DayRow[];
    const streak = computeStreak(
      days.map((row) => ({ day: row.day, counted: row.counted === 1, refunded: row.refunded === 1 })),
      day,
    );
    const { total } = this.db.prepare('SELECT COALESCE(SUM(xp), 0) AS total FROM assignments').get() as { total: number };

    this.log(`Streak: ${streak.streak} day${streak.streak === 1 ? '' : 's'} (longest ${streak.longest})`);
    this.log(`Freezes: ${streak.freezes}`);
    this.log(`Total XP: ${total}`);
    this.log('Tracks:');
    for (const track of TRACKS) {
      const progress = this.trackProgress(track);
      this.log(
        `  ${track.padEnd(12)} level ${progress.level}  clean ${progress.clean}/${CLEAN_SOLVES_TO_LEVEL_UP} to level up, rough ${progress.rough}/${ROUGH_OUTCOMES_TO_LEVEL_DOWN} to level down`,
      );
    }

    const daily = this.dailyFor(day) ?? this.unfinishedEarlierDaily(day);
    const rerolled = days.some((row) => row.day === day && row.rerolled === 1);
    if (!daily) {
      this.log(`Today (${day}): not started. Run \`kata today\`.`);
    } else if (daily.status === 'passed') {
      this.log(`Today (${day}): ${daily.title}, passed for ${daily.xp} XP.`);
    } else {
      const carried = daily.day !== day ? `, carried over from ${daily.day}` : '';
      this.log(
        `Today (${day}): ${daily.title}, in progress (${daily.failed_submits} failed submits, ${daily.hints} hints${carried}).`,
      );
    }
    this.log(`Reroll: ${rerolled ? 'used' : 'available'}`);
  }

  // --- adding challenges ------------------------------------------------------

  private async validateStaged(stagedDir: string): Promise<Verdict> {
    let id = path.basename(stagedDir);
    try {
      id = readMeta(stagedDir).id;
    } catch {
      // structure check below reports the problem
    }
    if (existsSync(path.join(this.paths.bank, id))) {
      return { id, admitted: false, check: 'structure', detail: `${id} is already in the bank` };
    }
    const verdict = await validateChallenge(stagedDir, this.runner, this.paths.runs);
    if (verdict.admitted) admit(stagedDir, this.paths.bank, verdict.id);
    return verdict;
  }

  private clearScratch(): void {
    clearStale([this.paths.staging, this.paths.runs]);
  }

  private report(verdict: Verdict): void {
    if (verdict.admitted) {
      this.log(`Admitted ${verdict.id}`);
    } else {
      this.log(`Rejected ${verdict.id}: ${CHECK_LABELS[verdict.check!]}`);
      if (verdict.detail) this.log(`  ${verdict.detail}`);
    }
  }

  async import(dirs: string[]): Promise<Verdict[]> {
    this.clearScratch();
    const verdicts: Verdict[] = [];
    for (const dir of dirs) {
      const source = path.resolve(dir);
      if (!existsSync(source)) throw new KataError(`${dir} does not exist.`);
      mkdirSync(this.paths.staging, { recursive: true });
      const staged = mkdtempSync(path.join(this.paths.staging, 'import-'));
      try {
        copyDir(source, staged);
        const verdict = await this.validateStaged(staged);
        this.report(verdict);
        verdicts.push(verdict);
      } finally {
        rmSync(staged, { recursive: true, force: true });
      }
    }
    return verdicts;
  }

  async generate(options: { count: number; track?: Track; level?: number; type?: ChallengeType }): Promise<Verdict[]> {
    this.clearScratch();
    mkdirSync(this.paths.staging, { recursive: true });
    const batch = mkdtempSync(path.join(this.paths.staging, 'generate-'));
    try {
      const template = readFileSync(path.join(PACKAGE_ROOT, 'prompts', 'generate.md'), 'utf8');
      const existing = this.bank().map((challenge) => challenge.id);
      const prompt = template
        .replaceAll('{{count}}', String(options.count))
        .replaceAll('{{track}}', options.track ?? 'any of ts-frontend, ts-backend, sql (mix them)')
        .replaceAll('{{level}}', options.level ? String(options.level) : 'any from 1 to 5 (mostly 2)')
        .replaceAll('{{type}}', options.type ?? 'any of build, debug, extend (mix them)')
        .replaceAll('{{existingIds}}', existing.length > 0 ? existing.join(', ') : '(none yet)');

      this.log(`Generating ${options.count} challenge(s) with ${this.config.claudeBin}…`);
      const result = spawnSync(this.config.claudeBin, ['-p', prompt, '--permission-mode', 'acceptEdits'], {
        cwd: batch,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      if (result.error) throw new KataError(`Could not run ${this.config.claudeBin}: ${result.error.message}`);
      if (result.status !== 0) throw new KataError(`${this.config.claudeBin} exited with status ${result.status}.`);

      const verdicts: Verdict[] = [];
      for (const dir of subdirectories(batch)) {
        const verdict = await this.validateStaged(dir);
        this.report(verdict);
        verdicts.push(verdict);
      }
      if (verdicts.length === 0) this.log('The generator wrote no challenge folders.');
      const admitted = verdicts.filter((verdict) => verdict.admitted).length;
      this.log(`${admitted} admitted, ${verdicts.length - admitted} rejected.`);
      return verdicts;
    } finally {
      rmSync(batch, { recursive: true, force: true });
    }
  }
}
