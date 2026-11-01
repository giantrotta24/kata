import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { dayKey } from './day.js';
import { homePaths } from './home.js';

export const NUDGE_LINE = "Today's kata isn't done";

// Runs on every shell start: no Docker, no network, never writes, never fails loudly.
export function nudge(home: string, now = new Date(), print: (line: string) => void = console.log): void {
  try {
    const file = homePaths(home).db;
    if (!existsSync(file)) return;
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
      const done = db
        .prepare(`SELECT 1 FROM assignments WHERE kind = 'daily' AND day = ? AND status = 'passed' LIMIT 1`)
        .get(dayKey(now));
      if (!done) print(NUDGE_LINE);
    } finally {
      db.close();
    }
  } catch {
    // stay silent
  }
}
