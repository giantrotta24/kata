import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/home.js';
import { editorArgv } from '../src/kata.js';
import { tempDir } from './helpers.js';

function homeWith(config: Record<string, unknown>): string {
  const home = tempDir('home');
  writeFileSync(path.join(home, 'config.json'), JSON.stringify(config));
  return home;
}

describe('editorCommand', () => {
  it('splits a string on whitespace and appends the workspace', () => {
    const { editorCommand } = loadConfig(homeWith({ editorCommand: 'cursor  --profile Kata' }));
    expect(editorArgv(editorCommand, '/ws')).toEqual(['cursor', '--profile', 'Kata', '/ws']);
  });

  it('uses an array as-is, so an argument may contain spaces', () => {
    const { editorCommand } = loadConfig(homeWith({ editorCommand: ['cursor', '--profile', 'My Kata'] }));
    expect(editorArgv(editorCommand, '/ws')).toEqual(['cursor', '--profile', 'My Kata', '/ws']);
  });

  it.each([[42], [['cursor', 3]], [[]], [null]])('rejects %j, naming the key', (editorCommand) => {
    expect(() => loadConfig(homeWith({ editorCommand }))).toThrow(/editorCommand in .*config\.json must be a string or a non-empty array of strings/);
  });
});
