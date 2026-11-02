export const TRACKS = ['ts-frontend', 'ts-backend', 'sql'] as const;
export type Track = (typeof TRACKS)[number];

export const CHALLENGE_TYPES = ['build', 'debug', 'extend'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

export interface ChallengeMeta {
  id: string;
  title: string;
  track: Track;
  type: ChallengeType;
  level: number;
  estimateMinutes: number;
  concepts: string[];
  existingTests?: string[];
}

export class KataError extends Error {}

export function isTrack(value: unknown): value is Track {
  return typeof value === 'string' && (TRACKS as readonly string[]).includes(value);
}

export function isChallengeType(value: unknown): value is ChallengeType {
  return typeof value === 'string' && (CHALLENGE_TYPES as readonly string[]).includes(value);
}

export function isLevel(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= MIN_LEVEL && (value as number) <= MAX_LEVEL;
}
