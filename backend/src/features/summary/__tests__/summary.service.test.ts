import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getSummary } from '../summary.service.js';

vi.mock('../../../shared/ports/profile.port.js', () => ({
  getProfile: vi.fn(),
}));
vi.mock('../../../shared/ports/food.port.js', () => ({
  getFoodEntries: vi.fn(),
}));
vi.mock('../../../shared/ports/exercise.port.js', () => ({
  getExerciseEntries: vi.fn(),
}));

import { getProfile } from '../../../shared/ports/profile.port.js';
import { getFoodEntries } from '../../../shared/ports/food.port.js';
import { getExerciseEntries } from '../../../shared/ports/exercise.port.js';

const mockGetProfile = vi.mocked(getProfile);
const mockGetFoodEntries = vi.mocked(getFoodEntries);
const mockGetExerciseEntries = vi.mocked(getExerciseEntries);

const USER_ID = 'user-123';

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const PROFILE_FOUND = {
  userId: USER_ID,
  age: 30,
  sex: 'male' as const,
  weight_kg: 80,
  height_cm: 180,
  activity_level: 'moderate' as const,
  bmr: 1500,
  tdee: 2200,
};

const EMPTY_FOOD = { entries: [], total_calories: 0, total_protein_g: 0 };
const EMPTY_EXERCISE = { entries: [], total_calories_burned: 0, total_duration_min: 0 };

const FOOD_ENTRIES = {
  entries: [
    {
      id: 'f1',
      userId: USER_ID,
      food_name: 'breakfast',
      calories: 500,
      protein_g: 30,
      carbs_g: null,
      fat_g: null,
      logged_at: '2026-06-05T08:00:00.000Z',
    },
    {
      id: 'f2',
      userId: USER_ID,
      food_name: 'lunch',
      calories: 700,
      protein_g: 40,
      carbs_g: null,
      fat_g: null,
      logged_at: '2026-06-08T12:00:00.000Z',
    },
    {
      id: 'f3',
      userId: USER_ID,
      food_name: 'dinner',
      calories: 600,
      protein_g: 20,
      carbs_g: null,
      fat_g: null,
      logged_at: '2026-06-11T19:00:00.000Z',
    },
    {
      id: 'f4',
      userId: USER_ID,
      food_name: 'out of range',
      calories: 9999,
      protein_g: 999,
      carbs_g: null,
      fat_g: null,
      logged_at: '2026-05-01T00:00:00.000Z',
    },
  ],
  total_calories: 11799,
  total_protein_g: 1089,
};

const EXERCISE_ENTRIES = {
  entries: [
    {
      id: 'e1',
      userId: USER_ID,
      exercise_name: 'run',
      calories_burned: 100,
      duration_min: null,
      logged_at: '2026-06-05T08:00:00.000Z',
    },
    {
      id: 'e2',
      userId: USER_ID,
      exercise_name: 'cycle',
      calories_burned: 150,
      duration_min: null,
      logged_at: '2026-06-09T12:00:00.000Z',
    },
    {
      id: 'e3',
      userId: USER_ID,
      exercise_name: 'out of range',
      calories_burned: 50,
      duration_min: null,
      logged_at: '2026-05-20T00:00:00.000Z',
    },
  ],
  total_calories_burned: 300,
  total_duration_min: 60,
};

describe('getSummary', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockGetFoodEntries.mockReset();
    mockGetExerciseEntries.mockReset();
  });

  it('aggregates food and exercise entries within the range into totals and averages', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_FOUND);
    mockGetFoodEntries.mockResolvedValue(FOOD_ENTRIES);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_ENTRIES);

    const result = await getSummary(USER_ID, { from: '2026-06-05', to: '2026-06-11' });

    expect(result).toEqual({
      from: '2026-06-05',
      to: '2026-06-11',
      days: 7,
      calories: {
        consumed_total: 1800,
        burned_total: 250,
        net_total: 1550,
        consumed_avg: 257.1,
        burned_avg: 35.7,
        net_avg: 221.4,
        target_total: 15400,
        remaining_total: 13850,
      },
      protein_g: {
        consumed_total: 90,
        consumed_avg: 12.9,
      },
      bmr: 1500,
      tdee: 2200,
    });
  });

  it('excludes entries dated exactly one day before from or one day after to', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue({
      entries: [
        {
          id: 'f1',
          userId: USER_ID,
          food_name: 'before range',
          calories: 500,
          protein_g: 30,
          carbs_g: null,
          fat_g: null,
          logged_at: '2026-06-04T23:59:59.000Z',
        },
        {
          id: 'f2',
          userId: USER_ID,
          food_name: 'after range',
          calories: 600,
          protein_g: 20,
          carbs_g: null,
          fat_g: null,
          logged_at: '2026-06-12T00:00:00.000Z',
        },
      ],
      total_calories: 1100,
      total_protein_g: 50,
    });
    mockGetExerciseEntries.mockResolvedValue({
      entries: [
        {
          id: 'e1',
          userId: USER_ID,
          exercise_name: 'before range',
          calories_burned: 100,
          duration_min: null,
          logged_at: '2026-06-04T23:59:59.000Z',
        },
        {
          id: 'e2',
          userId: USER_ID,
          exercise_name: 'after range',
          calories_burned: 150,
          duration_min: null,
          logged_at: '2026-06-12T00:00:00.000Z',
        },
      ],
      total_calories_burned: 250,
      total_duration_min: 30,
    });

    const result = await getSummary(USER_ID, { from: '2026-06-05', to: '2026-06-11' });

    expect(result.calories.consumed_total).toBe(0);
    expect(result.calories.burned_total).toBe(0);
    expect(result.protein_g.consumed_total).toBe(0);
  });

  it('returns null bmr/tdee/target_total/remaining_total when getProfile resolves null', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(FOOD_ENTRIES);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_ENTRIES);

    const result = await getSummary(USER_ID, { from: '2026-06-05', to: '2026-06-11' });

    expect(result.bmr).toBeNull();
    expect(result.tdee).toBeNull();
    expect(result.calories.target_total).toBeNull();
    expect(result.calories.remaining_total).toBeNull();
    expect(result.calories.consumed_total).toBe(1800);
    expect(result.calories.burned_total).toBe(250);
    expect(result.protein_g.consumed_total).toBe(90);
  });

  it('defaults to a trailing 7-day window ending today when neither from nor to is given', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const expectedFrom = addDays(today, -6);

    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(EMPTY_FOOD);
    mockGetExerciseEntries.mockResolvedValue(EMPTY_EXERCISE);

    const result = await getSummary(USER_ID, {});

    expect(result.to).toBe(today);
    expect(result.from).toBe(expectedFrom);
    expect(result.days).toBe(7);
  });

  it('derives from as 6 days before to when only to is given', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(EMPTY_FOOD);
    mockGetExerciseEntries.mockResolvedValue(EMPTY_EXERCISE);

    const result = await getSummary(USER_ID, { to: '2026-06-11' });

    expect(result.to).toBe('2026-06-11');
    expect(result.from).toBe('2026-06-05');
    expect(result.days).toBe(7);
  });

  it('defaults to as today when only from is given', async () => {
    const today = new Date().toISOString().slice(0, 10);

    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(EMPTY_FOOD);
    mockGetExerciseEntries.mockResolvedValue(EMPTY_EXERCISE);

    const result = await getSummary(USER_ID, { from: '2026-01-01' });

    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe(today);
  });

  it('queries food and exercise entries without a date filter', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(EMPTY_FOOD);
    mockGetExerciseEntries.mockResolvedValue(EMPTY_EXERCISE);

    await getSummary(USER_ID, { from: '2026-06-05', to: '2026-06-11' });

    expect(mockGetFoodEntries).toHaveBeenCalledWith(USER_ID, {});
    expect(mockGetExerciseEntries).toHaveBeenCalledWith(USER_ID, {});
  });
});
