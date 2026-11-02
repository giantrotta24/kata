import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const ROOT = '/opt/runner';
const SEED_FILE = `${ROOT}/work/tests/seed.sql`;
const REPORT_FILE = `${ROOT}/out/result.json`;
const track = process.env.KATA_TRACK;
const timeoutMs = Number(process.env.KATA_TIMEOUT_MS) || 120_000;
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
    `--outputFile=${REPORT_FILE}`,
    ...filters,
  ],
  // A synchronous infinite loop blocks Vitest's own test timeout, so kill the
  // whole run. This process is the container's PID 1; when it exits, any
  // leftover Vitest workers die with the container.
  { cwd: ROOT, env, stdio: 'inherit', timeout: timeoutMs, killSignal: 'SIGKILL' },
);
const timedOut = result.error?.code === 'ETIMEDOUT';
if (timedOut) writeFileSync(REPORT_FILE, JSON.stringify({ success: false, timedOut: true, timeoutMs }));

if (database) {
  await withClient('postgres', (client) => client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`));
}
process.exit(result.status ?? 1);
