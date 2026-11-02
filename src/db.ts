import Database from 'better-sqlite3';
import { TRACKS } from './types.js';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tracks (
  track TEXT PRIMARY KEY,
  level INTEGER NOT NULL DEFAULT 2,
  clean INTEGER NOT NULL DEFAULT 0,
  rough INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  origin_day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('daily', 'extra')),
  challenge_id TEXT NOT NULL,
  title TEXT NOT NULL,
  track TEXT NOT NULL,
  type TEXT NOT NULL,
  level INTEGER NOT NULL,
  workspace TEXT NOT NULL,
  started_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'passed', 'skipped', 'flagged')),
  hints INTEGER NOT NULL DEFAULT 0,
  failed_submits INTEGER NOT NULL DEFAULT 0,
  assisted INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  passed_at TEXT,
  duration_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id),
  submitted_at TEXT NOT NULL,
  passed INTEGER NOT NULL,
  assisted INTEGER NOT NULL,
  tests_passed INTEGER NOT NULL,
  tests_total INTEGER NOT NULL,
  run_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS days (
  day TEXT PRIMARY KEY,
  counted INTEGER NOT NULL DEFAULT 0,
  refunded INTEGER NOT NULL DEFAULT 0,
  rerolled INTEGER NOT NULL DEFAULT 0
);
`;

export function openDb(file: string): DB {
  const db = new Database(file);
  db.exec(SCHEMA);
  const insertTrack = db.prepare('INSERT OR IGNORE INTO tracks (track) VALUES (?)');
  for (const track of TRACKS) insertTrack.run(track);
  return db;
}
