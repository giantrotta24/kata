import { existsSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { add } from '../src/math';

it('adds two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

it('starts from a clean slate', () => {
  const marker = new URL('../src/.ran-before', import.meta.url);
  const dirty = existsSync(marker);
  writeFileSync(marker, 'leaked state\n');
  expect(dirty).toBe(false);
});
