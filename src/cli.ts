#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { resolveHome } from './home.js';
import { Kata } from './kata.js';
import { nudge } from './nudge.js';
import { isChallengeType, isLevel, isTrack, KataError, type ChallengeType, type Track } from './types.js';

function parseTrack(value: string): Track {
  if (!isTrack(value)) throw new InvalidArgumentError('Use ts-frontend, ts-backend or sql.');
  return value;
}

function parseLevel(value: string): number {
  const level = Number(value);
  if (!isLevel(level)) throw new InvalidArgumentError('Use a level from 1 to 5.');
  return level;
}

function parseType(value: string): ChallengeType {
  if (!isChallengeType(value)) throw new InvalidArgumentError('Use build, debug or extend.');
  return value;
}

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) throw new InvalidArgumentError('Use a positive whole number.');
  return count;
}

function homeOf(command: Command): string {
  return resolveHome(command.optsWithGlobals().home);
}

async function withKata(command: Command, action: (kata: Kata) => unknown): Promise<void> {
  const kata = new Kata({ home: homeOf(command) });
  try {
    await action(kata);
  } finally {
    kata.close();
  }
}

const program = new Command()
  .name('kata')
  .description('A daily coding challenge, solved by hand and graded by hidden tests.')
  .option('--home <dir>', 'Kata home folder (default: $KATA_HOME, then ~/.kata)');

program
  .command('today')
  .description("Start or reopen today's challenge")
  .option('--no-open', 'do not open the editor')
  .action((options, command) => withKata(command, (kata) => kata.today({ open: options.open })));

program
  .command('submit')
  .description('Grade the current challenge in Docker')
  .option('--assisted', 'you used AI: keeps the streak, earns no XP or level credit')
  .action((options, command) =>
    withKata(command, async (kata) => {
      const outcome = await kata.submit({ assisted: Boolean(options.assisted) });
      if (!outcome.passed) process.exitCode = 1;
    }),
  );

program
  .command('hint')
  .description('Reveal the next hint for the current challenge')
  .action((_options, command) => withKata(command, (kata) => kata.hint()));

program
  .command('reroll')
  .description('Swap the daily for another on the same track and level (once a day)')
  .option('--no-open', 'do not open the editor')
  .action((options, command) => withKata(command, (kata) => kata.reroll({ open: options.open })));

program
  .command('flag')
  .description('Mark the current challenge broken and remove it from the bank')
  .action((_options, command) => withKata(command, (kata) => kata.flag()));

program
  .command('next')
  .description('Start an extra challenge for today')
  .option('--track <track>', 'ts-frontend, ts-backend or sql', parseTrack)
  .option('--level <level>', '1 to 5', parseLevel)
  .option('--no-open', 'do not open the editor')
  .action((options, command) =>
    withKata(command, (kata) => kata.next({ track: options.track, level: options.level, open: options.open })),
  );

program
  .command('status')
  .description('Streak, freezes, XP, levels and today')
  .action((_options, command) => withKata(command, (kata) => kata.status()));

program
  .command('import')
  .description('Validate challenge folders (with solution/) and admit the ones that pass')
  .argument('<dirs...>', 'challenge folders')
  .action((dirs: string[], _options, command) =>
    withKata(command, async (kata) => {
      const verdicts = await kata.import(dirs);
      if (verdicts.some((verdict) => !verdict.admitted)) process.exitCode = 1;
    }),
  );

program
  .command('generate')
  .description('Generate challenges with claude -p, validate them and admit the ones that pass')
  .option('--count <n>', 'how many to generate', parseCount, 1)
  .option('--track <track>', 'ts-frontend, ts-backend or sql', parseTrack)
  .option('--level <level>', '1 to 5', parseLevel)
  .option('--type <type>', 'build, debug or extend', parseType)
  .action((options, command) =>
    withKata(command, (kata) =>
      kata.generate({ count: options.count, track: options.track, level: options.level, type: options.type }),
    ),
  );

program
  .command('nudge')
  .description("Print a reminder if today's daily hasn't passed (for your shell profile)")
  .action((_options, command) => nudge(homeOf(command)));

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof KataError ? error.message : error);
  process.exitCode = 1;
});
