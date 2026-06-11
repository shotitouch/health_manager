import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSummary } from '../summary.service.js';

const AUTH_HEADER = 'Bearer test-token';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const PROFILE_FOUND = jsonResponse(200, {
  data: { profile: { bmr: 1500, tdee: 2200 } },
  message: 'OK',
  error: null,
});

const PROFILE_NOT_FOUND = jsonResponse(404, {
  data: null,
  message: 'Profile not found',
  error: null,
});

const EMPTY_FOOD = jsonResponse(200, {
  data: { entries: [], total_calories: 0, total_protein_g: 0 },
  message: 'OK',
  error: null,
});

const EMPTY_EXERCISE = jsonResponse(200, {
  data: { entries: [], total_calories_burned: 0, total_duration_min: 0 },
  message: 'OK',
  error: null,
});

const FOOD_ENTRIES = jsonResponse(200, {
  data: {
    entries: [
      { calories: 500, protein_g: 30, logged_at: '2026-06-05T08:00:00.000Z' },
      { calories: 700, protein_g: 40, logged_at: '2026-06-08T12:00:00.000Z' },
      { calories: 600, protein_g: 20, logged_at: '2026-06-11T19:00:00.000Z' },
      { calories: 9999, protein_g: 999, logged_at: '2026-05-01T00:00:00.000Z' },
    ],
    total_calories: 11799,
    total_protein_g: 1089,
  },
  message: 'OK',
  error: null,
});

const EXERCISE_ENTRIES = jsonResponse(200, {
  data: {
    entries: [
      { calories_burned: 100, logged_at: '2026-06-05T08:00:00.000Z' },
      { calories_burned: 150, logged_at: '2026-06-09T12:00:00.000Z' },
      { calories_burned: 50, logged_at: '2026-05-20T00:00:00.000Z' },
    ],
    total_calories_burned: 300,
    total_duration_min: 60,
  },
  message: 'OK',
  error: null,
});

const UPSTREAM_ERROR = jsonResponse(500, {
  data: null,
  message: 'Internal server error',
  error: null,
});

describe('getSummary', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aggregates food and exercise entries within the range into totals and averages', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_ENTRIES);
      if (url.includes('/exercise/entries')) return Promise.resolve(EXERCISE_ENTRIES);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' });

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
    const justOutsideFood = jsonResponse(200, {
      data: {
        entries: [
          { calories: 500, protein_g: 30, logged_at: '2026-06-04T23:59:59.000Z' },
          { calories: 600, protein_g: 20, logged_at: '2026-06-12T00:00:00.000Z' },
        ],
        total_calories: 1100,
        total_protein_g: 50,
      },
      message: 'OK',
      error: null,
    });
    const justOutsideExercise = jsonResponse(200, {
      data: {
        entries: [
          { calories_burned: 100, logged_at: '2026-06-04T23:59:59.000Z' },
          { calories_burned: 150, logged_at: '2026-06-12T00:00:00.000Z' },
        ],
        total_calories_burned: 250,
        total_duration_min: 30,
      },
      message: 'OK',
      error: null,
    });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(justOutsideFood);
      if (url.includes('/exercise/entries')) return Promise.resolve(justOutsideExercise);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' });

    expect(result.calories.consumed_total).toBe(0);
    expect(result.calories.burned_total).toBe(0);
    expect(result.protein_g.consumed_total).toBe(0);
  });

  it('returns null bmr/tdee/target_total/remaining_total when the profile is not found (404)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_ENTRIES);
      if (url.includes('/exercise/entries')) return Promise.resolve(EXERCISE_ENTRIES);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' });

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

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
      return Promise.resolve(EMPTY_EXERCISE);
    });

    const result = await getSummary(AUTH_HEADER, {});

    expect(result.to).toBe(today);
    expect(result.from).toBe(expectedFrom);
    expect(result.days).toBe(7);
  });

  it('derives from as 6 days before to when only to is given', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
      return Promise.resolve(EMPTY_EXERCISE);
    });

    const result = await getSummary(AUTH_HEADER, { to: '2026-06-11' });

    expect(result.to).toBe('2026-06-11');
    expect(result.from).toBe('2026-06-05');
    expect(result.days).toBe(7);
  });

  it('defaults to as today when only from is given', async () => {
    const today = new Date().toISOString().slice(0, 10);

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
      return Promise.resolve(EMPTY_EXERCISE);
    });

    const result = await getSummary(AUTH_HEADER, { from: '2026-01-01' });

    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe(today);
  });

  it('forwards the Authorization header to all three internal requests and queries entries without a date filter', async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];

    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      calls.push({ url, headers: init?.headers as Record<string, string> | undefined });
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
      return Promise.resolve(EMPTY_EXERCISE);
    });

    await getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    for (const { headers } of calls) {
      expect(headers).toMatchObject({ Authorization: AUTH_HEADER });
    }

    const foodCall = calls.find((c) => c.url.includes('/food/entries'));
    const exerciseCall = calls.find((c) => c.url.includes('/exercise/entries'));
    expect(foodCall?.url).not.toContain('date=');
    expect(exerciseCall?.url).not.toContain('date=');
  });

  describe('upstream errors', () => {
    it('throws a 502 AppError when the profile endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(UPSTREAM_ERROR);
        if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
        return Promise.resolve(EMPTY_EXERCISE);
      });

      await expect(
        getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' })
      ).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch profile data',
      });
    });

    it('throws a 502 AppError when the food endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.resolve(UPSTREAM_ERROR);
        return Promise.resolve(EMPTY_EXERCISE);
      });

      await expect(
        getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' })
      ).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch food data',
      });
    });

    it('throws a 502 AppError when the exercise endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.resolve(EMPTY_FOOD);
        return Promise.resolve(UPSTREAM_ERROR);
      });

      await expect(
        getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' })
      ).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch exercise data',
      });
    });

    it('rejects when an internal fetch call itself fails (e.g. connection refused)', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.reject(new TypeError('fetch failed'));
        return Promise.resolve(EMPTY_EXERCISE);
      });

      await expect(
        getSummary(AUTH_HEADER, { from: '2026-06-05', to: '2026-06-11' })
      ).rejects.toThrow('fetch failed');
    });
  });
});
