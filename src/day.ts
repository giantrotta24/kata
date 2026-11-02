export const DAY_START_HOUR = 3;

const MS_PER_DAY = 86_400_000;

export function dayKey(date: Date): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (date.getHours() < DAY_START_HOUR) day.setDate(day.getDate() - 1);
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${dayOfMonth}`;
}

function toUtc(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  return Date.UTC(year, month - 1, date);
}

export function addDays(day: string, count: number): string {
  return new Date(toUtc(day) + count * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}
