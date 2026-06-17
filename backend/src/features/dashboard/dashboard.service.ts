import { getProfile } from '../../shared/ports/profile.port.js';
import { getFoodEntries } from '../../shared/ports/food.port.js';
import { getExerciseEntries } from '../../shared/ports/exercise.port.js';

export interface DashboardInput {
  date?: string;
}

export interface DashboardData {
  date: string;
  calories: {
    consumed: number;
    burned: number;
    net: number;
    target: number | null;
    remaining: number | null;
  };
  protein_g: {
    consumed: number;
  };
  bmr: number | null;
  tdee: number | null;
}

export async function getDashboard(userId: string, input: DashboardInput): Promise<DashboardData> {
  const date = input.date ?? new Date().toISOString().slice(0, 10);

  const [profile, food, exercise] = await Promise.all([
    getProfile(userId),
    getFoodEntries(userId, { date }),
    getExerciseEntries(userId, { date }),
  ]);

  const consumed = food.total_calories;
  const burned = exercise.total_calories_burned;
  const net = consumed - burned;
  const target = profile?.tdee ?? null;

  return {
    date,
    calories: {
      consumed,
      burned,
      net,
      target,
      remaining: target !== null ? target - net : null,
    },
    protein_g: { consumed: food.total_protein_g },
    bmr: profile?.bmr ?? null,
    tdee: profile?.tdee ?? null,
  };
}
