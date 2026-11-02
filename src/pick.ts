import { daysBetween } from './day.js';
import { MAX_LEVEL, TRACKS, type ChallengeMeta, type ChallengeType, type Track } from './types.js';

export const STRETCH_CHANCE = 0.2;
export const NEGLECT_CAP_DAYS = 14;
export const RECENT_TYPES_WINDOW = 3;

export interface PickState {
  levels: Record<Track, number>;
  lastPracticed: Partial<Record<Track, string>>;
  passedIds: Set<string>;
  excludedIds: Set<string>;
  recentTypes: ChallengeType[];
}

export interface Pick {
  challenge: ChallengeMeta;
  stretch: boolean;
}

export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededRandom(seed: string): () => number {
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trackWeight(level: number, daysSincePracticed: number): number {
  const neglect = Math.min(daysSincePracticed, NEGLECT_CAP_DAYS);
  return 3 ** (MAX_LEVEL - level) * (1 + neglect / 7);
}

function daysSince(day: string, last: string | undefined): number {
  return last ? Math.max(0, daysBetween(last, day)) : NEGLECT_CAP_DAYS;
}

function weightedOrder<T>(items: { item: T; weight: number }[], random: () => number): T[] {
  const remaining = [...items];
  const order: T[] = [];
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    let index = remaining.findIndex((entry) => (roll -= entry.weight) < 0);
    if (index === -1) index = remaining.length - 1;
    order.push(remaining[index].item);
    remaining.splice(index, 1);
  }
  return order;
}

function pickMixingTypes(pool: ChallengeMeta[], recentTypes: ChallengeType[], random: () => number): ChallengeMeta {
  const types = [...new Set(pool.map((challenge) => challenge.type))].sort();
  const weighted = types.map((type) => ({
    item: type,
    weight: 1 / (1 + recentTypes.filter((recent) => recent === type).length),
  }));
  const [type] = weightedOrder(weighted, random);
  const ofType = pool.filter((challenge) => challenge.type === type);
  return ofType[Math.floor(random() * ofType.length)];
}

function eligible(bank: ChallengeMeta[], state: PickState): ChallengeMeta[] {
  return [...bank]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((challenge) => !state.passedIds.has(challenge.id) && !state.excludedIds.has(challenge.id));
}

function tracksByWeight(day: string, state: PickState, random: () => number): Track[] {
  return weightedOrder(
    TRACKS.map((track) => ({
      item: track,
      weight: trackWeight(state.levels[track], daysSince(day, state.lastPracticed[track])),
    })),
    random,
  );
}

export function pickDaily(day: string, bank: ChallengeMeta[], state: PickState): Pick | null {
  const random = seededRandom(`daily:${day}`);
  const stretch = random() < STRETCH_CHANCE;
  const candidates = eligible(bank, state);

  for (const track of tracksByWeight(day, state, random)) {
    const base = state.levels[track];
    const levels = stretch && base < MAX_LEVEL ? [base + 1, base] : [base];
    for (const level of levels) {
      const pool = candidates.filter((challenge) => challenge.track === track && challenge.level === level);
      if (pool.length > 0) {
        return { challenge: pickMixingTypes(pool, state.recentTypes, random), stretch: level > base };
      }
    }
  }
  return null;
}

export function pickReroll(
  day: string,
  bank: ChallengeMeta[],
  state: PickState,
  track: Track,
  level: number,
): ChallengeMeta | null {
  const random = seededRandom(`reroll:${day}`);
  const pool = eligible(bank, state).filter((challenge) => challenge.track === track && challenge.level === level);
  return pool.length > 0 ? pickMixingTypes(pool, state.recentTypes, random) : null;
}

export function pickExtra(
  day: string,
  sequence: number,
  bank: ChallengeMeta[],
  state: PickState,
  filters: { track?: Track; level?: number },
): ChallengeMeta | null {
  const random = seededRandom(`extra:${day}:${sequence}`);
  const candidates = eligible(bank, state);
  const tracks = filters.track ? [filters.track] : tracksByWeight(day, state, random);

  for (const track of tracks) {
    const level = filters.level ?? state.levels[track];
    const pool = candidates.filter((challenge) => challenge.track === track && challenge.level === level);
    if (pool.length > 0) return pickMixingTypes(pool, state.recentTypes, random);
  }
  return null;
}
