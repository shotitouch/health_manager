import { createHttpError } from '../../shared/middleware/errorHandler.js';

export interface FoodEntry {
  id: string;
  userId: string;
  food_name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
}

export interface FoodEntryInput {
  food_name: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  logged_at?: string;
}

export interface GetEntriesInput {
  date?: string;
}

export interface GetEntriesResult {
  entries: FoodEntry[];
  total_calories: number;
  total_protein_g: number;
}

const store = new Map<string, FoodEntry[]>();
const MAX_ENTRIES_PER_USER = 1000;

export async function logFoodEntry(userId: string, input: FoodEntryInput): Promise<FoodEntry> {
  if (!store.has(userId)) store.set(userId, []);
  const list = store.get(userId)!;
  if (list.length >= MAX_ENTRIES_PER_USER) throw createHttpError('Entry limit reached', 429);

  const entry: FoodEntry = {
    id: crypto.randomUUID(),
    userId,
    food_name: input.food_name,
    calories: input.calories,
    protein_g: input.protein_g ?? null,
    carbs_g: input.carbs_g ?? null,
    fat_g: input.fat_g ?? null,
    logged_at: input.logged_at ?? new Date().toISOString(),
  };

  list.push(entry);
  return entry;
}

export async function getFoodEntries(
  userId: string,
  input: GetEntriesInput
): Promise<GetEntriesResult> {
  const list = store.get(userId) ?? [];

  const { date } = input;
  const entries = date ? list.filter((e) => e.logged_at.slice(0, 10) === date) : list;

  const total_calories = entries.reduce((sum, e) => sum + e.calories, 0);
  const total_protein_g = entries.reduce((sum, e) => sum + (e.protein_g ?? 0), 0);

  return { entries, total_calories, total_protein_g };
}
