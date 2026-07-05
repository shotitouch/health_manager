import { getProfile } from '../../shared/ports/profile.port.js';
import { getFoodEntries } from '../../shared/ports/food.port.js';
import { getExerciseEntries } from '../../shared/ports/exercise.port.js';

export interface SummaryInput {
  from?: string;
  to?: string;
}

export interface SummaryData {
  from: string;
  to: string;
  days: number;
  calories: {
    consumed_total: number;
    burned_total: number;
    net_total: number;
    consumed_avg: number;
    burned_avg: number;
    net_avg: number;
    target_total: number | null;
    remaining_total: number | null;
  };
  protein_g: {
    consumed_total: number;
    consumed_avg: number;
  };
  bmr: number | null;
  tdee: number | null;
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function countDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

function inRange(loggedAt: string, from: string, to: string): boolean {
  const day = loggedAt.slice(0, 10);
  return day >= from && day <= to;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getSummary(userId: string, input: SummaryInput): Promise<SummaryData> {
  const to = input.to ?? new Date().toISOString().slice(0, 10);
  const from = input.from ?? addDays(to, -6);
  const days = countDays(from, to);

  const [profile, food, exercise] = await Promise.all([
    getProfile(userId),
    getFoodEntries(userId, {}),
    getExerciseEntries(userId, {}),
  ]);

  const foodInRange = food.entries.filter((e) => inRange(e.logged_at, from, to));
  const exerciseInRange = exercise.entries.filter((e) => inRange(e.logged_at, from, to));

  const consumedTotal = foodInRange.reduce((sum, e) => sum + e.calories, 0);
  const proteinTotal = foodInRange.reduce((sum, e) => sum + (e.protein_g ?? 0), 0);
  const burnedTotal = exerciseInRange.reduce((sum, e) => sum + e.calories_burned, 0);
  const netTotal = consumedTotal - burnedTotal;

  const tdee = profile?.tdee ?? null;
  const targetTotal = tdee !== null ? tdee * days : null;

  return {
    from,
    to,
    days,
    calories: {
      consumed_total: round1(consumedTotal),
      burned_total: round1(burnedTotal),
      net_total: round1(netTotal),
      consumed_avg: round1(consumedTotal / days),
      burned_avg: round1(burnedTotal / days),
      net_avg: round1(netTotal / days),
      target_total: targetTotal !== null ? round1(targetTotal) : null,
      remaining_total: targetTotal !== null ? round1(targetTotal - netTotal) : null,
    },
    protein_g: {
      consumed_total: round1(proteinTotal),
      consumed_avg: round1(proteinTotal / days),
    },
    bmr: profile?.bmr ?? null,
    tdee,
  };
}
