import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KataError } from './types.js';

export const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));

// A string editorCommand is split on whitespace, with no quoting. An array is
// used as-is, so an argument may contain spaces.
export type EditorCommand = string | string[];

export interface Config {
  workspaceDir: string;
  editorCommand: EditorCommand;
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
  const editor: unknown = config.editorCommand;
  const validEditor =
    typeof editor === 'string' ||
    (Array.isArray(editor) && editor.length > 0 && editor.every((part) => typeof part === 'string'));
  if (!validEditor) {
    throw new KataError(`editorCommand in ${file} must be a string or a non-empty array of strings.`);
  }
  return {
    workspaceDir: path.resolve(home, expandTilde(config.workspaceDir)),
    editorCommand: config.editorCommand,
    claudeBin: config.claudeBin.includes('/') ? path.resolve(home, expandTilde(config.claudeBin)) : config.claudeBin,
  };
}
