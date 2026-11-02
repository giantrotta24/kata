import { expect, it } from 'vitest';
import { isEven } from '../src/even';

it('knows even from odd', () => {
  expect(isEven(4)).toBe(true);
  expect(isEven(7)).toBe(false);
});
