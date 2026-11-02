import { expect, it } from 'vitest';
import { runQueryFile } from './db';

it('lists every customer by lifetime spend, highest first (order matters)', async () => {
  expect(await runQueryFile('customer_totals.sql')).toEqual([
    { name: 'Brook', total_cents: 9900 },
    { name: 'Ada', total_cents: 3700 },
    { name: 'Dee', total_cents: 3700 },
    { name: 'Cy', total_cents: 0 },
    { name: 'Eli', total_cents: 0 },
  ]);
});
