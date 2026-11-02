import { addDays } from './day.js';

export const STARTING_FREEZES = 2;
export const MAX_FREEZES = 3;
export const DAYS_PER_EARNED_FREEZE = 7;

export interface DayRecord {
  day: string;
  counted: boolean;
  refunded: boolean;
}

export interface StreakState {
  streak: number;
  longest: number;
  freezes: number;
  freezesUsed: number;
}

// Replays every day from the first counted one, so days before any streak exists
// spend no freezes. A refunded day (a flagged daily) is neutral, and today is
// still in progress, so neither breaks the streak.
export function computeStreak(records: DayRecord[], today: string): StreakState {
  const state: StreakState = { streak: 0, longest: 0, freezes: STARTING_FREEZES, freezesUsed: 0 };
  const first = records.filter((record) => record.counted).map((record) => record.day).sort()[0];
  if (!first) return state;

  const byDay = new Map(records.map((record) => [record.day, record]));
  let countedRun = 0;

  for (let day = first; day <= today; day = addDays(day, 1)) {
    const record = byDay.get(day);
    if (record?.counted) {
      state.streak += 1;
      countedRun += 1;
      state.longest = Math.max(state.longest, state.streak);
      if (countedRun % DAYS_PER_EARNED_FREEZE === 0) {
        state.freezes = Math.min(MAX_FREEZES, state.freezes + 1);
      }
    } else if (record?.refunded || day === today) {
      continue;
    } else if (state.freezes > 0) {
      state.freezes -= 1;
      state.freezesUsed += 1;
      countedRun = 0;
    } else {
      state.streak = 0;
      countedRun = 0;
    }
  }
  return state;
}
