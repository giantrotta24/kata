import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Kata } from '../src/kata.js';
import { NUDGE_LINE, nudge } from '../src/nudge.js';
import { addToBank, FakeRunner, tempDir } from './helpers.js';

const NOW = new Date(2026, 10, 1, 9, 0);

function collect(home: string): string[] {
  const lines: string[] = [];
  nudge(home, NOW, (line) => lines.push(line));
  return lines;
}

describe('nudge', () => {
  it('is silent and creates nothing when the home folder is missing', () => {
    const home = path.join(tempDir('nudge'), 'missing');
    expect(collect(home)).toEqual([]);
    expect(existsSync(home)).toBe(false);
  });

  it('is silent when the database is missing', () => {
    const home = tempDir('nudge');
    expect(collect(home)).toEqual([]);
    expect(existsSync(path.join(home, 'kata.db'))).toBe(false);
  });

  it("prints one line until today's daily passes, then nothing", async () => {
    const home = tempDir('nudge');
    addToBank(home, { id: 'alpha' });
    const kata = new Kata({
      home,
      config: { workspaceDir: path.join(home, 'ws'), editorCommand: 'true', claudeBin: 'false' },
      runner: new FakeRunner(),
      now: () => NOW,
      log: () => {},
      openEditor: () => {},
    });
    const daily = kata.today({ open: false });
    expect(collect(home)).toEqual([NUDGE_LINE]);

    writeFileSync(path.join(daily.workspace, 'starter', 'SOLVED'), '');
    await kata.submit();
    kata.close();
    expect(collect(home)).toEqual([]);
  });
});
