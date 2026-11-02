import { expect, it } from 'vitest';
import * as numbers from '../src/numbers';

it('triples a number', () => {
  expect((numbers as { triple?: (n: number) => number }).triple?.(4)).toBe(12);
});
