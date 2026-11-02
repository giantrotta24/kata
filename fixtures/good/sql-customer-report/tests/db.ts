import { readFileSync } from 'node:fs';
import pg from 'pg';

export async function runQueryFile(name: string): Promise<Record<string, unknown>[]> {
  const sql = readFileSync(new URL(`../src/queries/${name}`, import.meta.url), 'utf8');
  const client = new pg.Client();
  await client.connect();
  try {
    const result = await client.query(sql);
    return result.rows ?? [];
  } finally {
    await client.end();
  }
}

export function sortedBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): T[] {
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}
