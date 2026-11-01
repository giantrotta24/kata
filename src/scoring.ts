import { MAX_LEVEL, MIN_LEVEL } from './types.js';

export const BASE_XP: Record<number, number> = { 1: 10, 2: 20, 3: 40, 4: 70, 5: 100 };
export const FAILED_SUBMIT_FACTOR = 0.9;
export const FAILURE_FLOOR = 0.5;
export const FIRST_SUBMIT_BONUS = 1.2;
export const HINT_FACTOR = 0.75;

export const CLEAN_SOLVES_TO_LEVEL_UP = 3;
export const ROUGH_OUTCOMES_TO_LEVEL_DOWN = 2;

export interface PassFacts {
  level: number;
  failedSubmits: number;
  hints: number;
  assisted: boolean;
}

export function xpFor({ level, failedSubmits, hints, assisted }: PassFacts): number {
  if (assisted) return 0;
  const submitFactor =
    failedSubmits === 0 ? FIRST_SUBMIT_BONUS : Math.max(FAILURE_FLOOR, FAILED_SUBMIT_FACTOR ** failedSubmits);
  const raw = BASE_XP[level] * submitFactor * HINT_FACTOR ** hints;
  return Math.floor(raw + 1e-9);
}

export type Outcome = 'clean' | 'rough' | 'neutral';

export function passOutcome({ failedSubmits, hints }: { failedSubmits: number; hints: number }): Outcome {
  if (hints >= 2) return 'rough';
  if (failedSubmits <= 1 && hints === 0) return 'clean';
  return 'neutral';
}

export interface TrackProgress {
  level: number;
  clean: number;
  rough: number;
}

export function applyOutcome(progress: TrackProgress, outcome: Outcome): TrackProgress {
  if (outcome === 'clean') {
    const clean = progress.clean + 1;
    if (clean >= CLEAN_SOLVES_TO_LEVEL_UP && progress.level < MAX_LEVEL) {
      return { level: progress.level + 1, clean: 0, rough: 0 };
    }
    return { ...progress, clean: Math.min(clean, CLEAN_SOLVES_TO_LEVEL_UP) };
  }
  if (outcome === 'rough') {
    const rough = progress.rough + 1;
    if (rough >= ROUGH_OUTCOMES_TO_LEVEL_DOWN && progress.level > MIN_LEVEL) {
      return { level: progress.level - 1, clean: 0, rough: 0 };
    }
    return { ...progress, rough: Math.min(rough, ROUGH_OUTCOMES_TO_LEVEL_DOWN) };
  }
  return progress;
}
