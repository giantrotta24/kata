import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KataError } from './types.js';

export const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));

export interface Config {
  workspaceDir: string;
  editorCommand: string;
  claudeBin: string;
}

export const DEFAULT_CONFIG: Config = {
  workspaceDir: '~/kata',
  editorCommand: 'cursor --profile Kata',
  claudeBin: 'claude',
};

export function expandTilde(value: string): string {
  if (value === '~') return homedir();
  if (value.startsWith('~/')) return path.join(homedir(), value.slice(2));
  return value;
}

export function resolveHome(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(expandTilde(flag ?? env.KATA_HOME ?? '~/.kata'));
}

export function homePaths(home: string) {
  return {
    bank: path.join(home, 'bank'),
    staging: path.join(home, 'staging'),
    runs: path.join(home, 'runs'),
    db: path.join(home, 'kata.db'),
    config: path.join(home, 'config.json'),
  };
}

// Relative paths in config.json resolve against the home folder.
export function loadConfig(home: string): Config {
  const file = homePaths(home).config;
  let overrides: Partial<Config> = {};
  if (existsSync(file)) {
    try {
      overrides = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      throw new KataError(`Could not read ${file}: ${(error as Error).message}`);
    }
  }
  const config = { ...DEFAULT_CONFIG, ...overrides };
  return {
    workspaceDir: path.resolve(home, expandTilde(config.workspaceDir)),
    editorCommand: config.editorCommand,
    claudeBin: config.claudeBin.includes('/') ? path.resolve(home, expandTilde(config.claudeBin)) : config.claudeBin,
  };
}
