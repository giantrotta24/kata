import { expect, it } from 'vitest';
import { double } from '../src/numbers';

it('doubles a number', () => {
  expect(double(5)).toBe(10);
});
