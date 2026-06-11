import { createHttpError } from '../../shared/middleware/errorHandler.js';

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

function getBaseUrl(): string {
  return process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
}

interface ProfileTotals {
  bmr: number;
  tdee: number;
}

interface FoodTotals {
  total_calories: number;
  total_protein_g: number;
}

interface ExerciseTotals {
  total_calories_burned: number;
  total_duration_min: number;
}

async function fetchProfile(authHeader: string): Promise<ProfileTotals | null> {
  const res = await fetch(`${getBaseUrl()}/api/v1/profile`, {
    headers: { Authorization: authHeader },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw createHttpError('Failed to fetch profile data', 502);

  const body = (await res.json()) as { data: { profile: ProfileTotals } };
  return { bmr: body.data.profile.bmr, tdee: body.data.profile.tdee };
}

async function fetchFoodTotals(authHeader: string, date: string): Promise<FoodTotals> {
  const res = await fetch(`${getBaseUrl()}/api/v1/food/entries?date=${date}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) throw createHttpError('Failed to fetch food data', 502);

  const body = (await res.json()) as { data: FoodTotals };
  return body.data;
}

async function fetchExerciseTotals(authHeader: string, date: string): Promise<ExerciseTotals> {
  const res = await fetch(`${getBaseUrl()}/api/v1/exercise/entries?date=${date}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) throw createHttpError('Failed to fetch exercise data', 502);

  const body = (await res.json()) as { data: ExerciseTotals };
  return body.data;
}

export async function getDashboard(
  authHeader: string,
  input: DashboardInput
): Promise<DashboardData> {
  const date = input.date ?? new Date().toISOString().slice(0, 10);

  const [profile, food, exercise] = await Promise.all([
    fetchProfile(authHeader),
    fetchFoodTotals(authHeader, date),
    fetchExerciseTotals(authHeader, date),
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
