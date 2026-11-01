import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const ROOT = '/opt/runner';
const SEED_FILE = `${ROOT}/work/tests/seed.sql`;
const track = process.env.KATA_TRACK;
const filters = process.argv.slice(2);

async function withClient(database, action) {
  const client = new pg.Client({ database });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

async function createDatabase() {
  const name = `kata_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await withClient('postgres', (client) => client.query(`CREATE DATABASE ${name}`));
  if (existsSync(SEED_FILE)) {
    await withClient(name, (client) => client.query(readFileSync(SEED_FILE, 'utf8')));
  }
  return name;
}

const env = { ...process.env };
let database;
if (track === 'sql') {
  database = await createDatabase();
  env.PGDATABASE = database;
}

const result = spawnSync(
  process.execPath,
  [
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.config.mjs',
    '--reporter=json',
    '--outputFile=out/result.json',
    ...filters,
  ],
  { cwd: ROOT, env, stdio: 'inherit' },
);

if (database) {
  await withClient('postgres', (client) => client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`));
}
process.exit(result.status ?? 1);
