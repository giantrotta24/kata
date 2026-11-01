import { expect, it } from 'vitest';
import { runQueryFile, sortedBy } from './db';

it('lists customers who never ordered, in any order', async () => {
  const rows = await runQueryFile('inactive_customers.sql');
  expect(sortedBy(rows, 'name')).toEqual([
    { name: 'Cy', signed_up: '2026-02-10' },
    { name: 'Eli', signed_up: '2026-03-22' },
  ]);
});
