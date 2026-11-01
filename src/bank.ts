import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  isChallengeType,
  isLevel,
  isTrack,
  KataError,
  type ChallengeMeta,
} from './types.js';

export const HINT_COUNT = 3;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isDir(target: string): boolean {
  return existsSync(target) && statSync(target).isDirectory();
}

export function subdirectories(dir: string): string[] {
  if (!isDir(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && isDir(path.join(dir, name)))
    .sort()
    .map((name) => path.join(dir, name));
}

export function copyDir(source: string, target: string): void {
  cpSync(source, target, {
    recursive: true,
    filter: (entry) => !entry.split(path.sep).includes('node_modules'),
  });
}

export function metaProblems(meta: unknown): string[] {
  if (typeof meta !== 'object' || meta === null) return ['meta.json is not an object'];
  const m = meta as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof m.id !== 'string' || !ID_PATTERN.test(m.id)) problems.push('id must be lowercase kebab-case');
  if (typeof m.title !== 'string' || m.title.trim() === '') problems.push('title is required');
  if (!isTrack(m.track)) problems.push('track must be ts-frontend, ts-backend or sql');
  if (!isChallengeType(m.type)) problems.push('type must be build, debug or extend');
  if (!isLevel(m.level)) problems.push('level must be an integer from 1 to 5');
  if (typeof m.estimateMinutes !== 'number' || m.estimateMinutes <= 0) problems.push('estimateMinutes must be positive');
  if (!Array.isArray(m.concepts) || !m.concepts.every((tag) => typeof tag === 'string')) {
    problems.push('concepts must be a list of strings');
  }
  if (m.type === 'extend') {
    if (!Array.isArray(m.existingTests) || m.existingTests.length === 0) {
      problems.push('extend challenges must list existingTests');
    }
  }
  return problems;
}

export function readMeta(dir: string): ChallengeMeta {
  const file = path.join(dir, 'meta.json');
  let meta: unknown;
  try {
    meta = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new KataError(`Could not read ${file}: ${(error as Error).message}`);
  }
  const problems = metaProblems(meta);
  if (problems.length > 0) throw new KataError(`${file}: ${problems.join('; ')}`);
  return meta as ChallengeMeta;
}

export function loadBank(bankDir: string): ChallengeMeta[] {
  return subdirectories(bankDir)
    .filter((dir) => existsSync(path.join(dir, 'meta.json')))
    .map(readMeta);
}

export function parseHints(markdown: string): string[] {
  return markdown
    .split(/^##[^\n]*\n/m)
    .slice(1)
    .map((hint) => hint.trim())
    .filter((hint) => hint.length > 0);
}
