import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getDashboard } from '../dashboard.service.js';

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

const FOOD_TOTALS = { entries: [], total_calories: 1800, total_protein_g: 90 };
const EXERCISE_TOTALS = { entries: [], total_calories_burned: 300, total_duration_min: 30 };

describe('getDashboard', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockGetFoodEntries.mockReset();
    mockGetExerciseEntries.mockReset();
  });

  it('aggregates profile, food, and exercise totals into the dashboard shape', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_FOUND);
    mockGetFoodEntries.mockResolvedValue(FOOD_TOTALS);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_TOTALS);

    const result = await getDashboard(USER_ID, { date: '2026-06-10' });

    expect(result).toEqual({
      date: '2026-06-10',
      calories: { consumed: 1800, burned: 300, net: 1500, target: 2200, remaining: 700 },
      protein_g: { consumed: 90 },
      bmr: 1500,
      tdee: 2200,
    });
  });

  it('computes negative net and remaining when burned exceeds consumed and target', async () => {
    mockGetProfile.mockResolvedValue(PROFILE_FOUND);
    mockGetFoodEntries.mockResolvedValue({ entries: [], total_calories: 500, total_protein_g: 30 });
    mockGetExerciseEntries.mockResolvedValue({
      entries: [],
      total_calories_burned: 3000,
      total_duration_min: 120,
    });

    const result = await getDashboard(USER_ID, { date: '2026-06-10' });

    expect(result.calories.net).toBe(-2500);
    expect(result.calories.remaining).toBe(4700); // target (2200) - net (-2500)
  });

  it('returns null bmr/tdee/target/remaining when getProfile resolves null', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(FOOD_TOTALS);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_TOTALS);

    const result = await getDashboard(USER_ID, { date: '2026-06-10' });

    expect(result.bmr).toBeNull();
    expect(result.tdee).toBeNull();
    expect(result.calories.target).toBeNull();
    expect(result.calories.remaining).toBeNull();
    expect(result.calories.consumed).toBe(1800);
    expect(result.calories.burned).toBe(300);
    expect(result.protein_g.consumed).toBe(90);
  });

  it('defaults date to today when not provided', async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(FOOD_TOTALS);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_TOTALS);

    const result = await getDashboard(USER_ID, {});

    expect(result.date).toBe(today);
    expect(mockGetFoodEntries).toHaveBeenCalledWith(USER_ID, { date: today });
    expect(mockGetExerciseEntries).toHaveBeenCalledWith(USER_ID, { date: today });
  });

  it('uses the provided date in food and exercise requests', async () => {
    mockGetProfile.mockResolvedValue(null);
    mockGetFoodEntries.mockResolvedValue(FOOD_TOTALS);
    mockGetExerciseEntries.mockResolvedValue(EXERCISE_TOTALS);

    await getDashboard(USER_ID, { date: '2026-01-02' });

    expect(mockGetFoodEntries).toHaveBeenCalledWith(USER_ID, { date: '2026-01-02' });
    expect(mockGetExerciseEntries).toHaveBeenCalledWith(USER_ID, { date: '2026-01-02' });
  });
});
