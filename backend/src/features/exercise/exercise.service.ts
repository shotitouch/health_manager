import { createHttpError } from '../../shared/middleware/errorHandler.js';

export interface ExerciseEntry {
  id: string;
  userId: string;
  exercise_name: string;
  calories_burned: number;
  duration_min: number | null;
  logged_at: string;
}

export interface ExerciseEntryInput {
  exercise_name: string;
  calories_burned: number;
  duration_min?: number;
  logged_at?: string;
}

export interface GetEntriesInput {
  date?: string;
}

export interface GetEntriesResult {
  entries: ExerciseEntry[];
  total_calories_burned: number;
  total_duration_min: number;
}

const store = new Map<string, ExerciseEntry[]>();
const MAX_ENTRIES_PER_USER = 1000;

export async function logExerciseEntry(
  userId: string,
  input: ExerciseEntryInput
): Promise<ExerciseEntry> {
  if (!store.has(userId)) store.set(userId, []);
  const list = store.get(userId)!;
  if (list.length >= MAX_ENTRIES_PER_USER) throw createHttpError('Entry limit reached', 429);

  const entry: ExerciseEntry = {
    id: crypto.randomUUID(),
    userId,
    exercise_name: input.exercise_name,
    calories_burned: input.calories_burned,
    duration_min: input.duration_min ?? null,
    logged_at: input.logged_at ?? new Date().toISOString(),
  };

  list.push(entry);
  return entry;
}

export async function getExerciseEntries(
  userId: string,
  input: GetEntriesInput
): Promise<GetEntriesResult> {
  const list = store.get(userId) ?? [];

  const { date } = input;
  const entries = date ? list.filter((e) => e.logged_at.slice(0, 10) === date) : list;

  const total_calories_burned = entries.reduce((sum, e) => sum + e.calories_burned, 0);
  const total_duration_min = entries.reduce((sum, e) => sum + (e.duration_min ?? 0), 0);

  return { entries, total_calories_burned, total_duration_min };
}
