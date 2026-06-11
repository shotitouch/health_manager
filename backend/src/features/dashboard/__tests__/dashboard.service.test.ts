import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDashboard } from '../dashboard.service.js';

const AUTH_HEADER = 'Bearer test-token';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
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

const FOOD_TOTALS = jsonResponse(200, {
  data: { entries: [], total_calories: 1800, total_protein_g: 90 },
  message: 'OK',
  error: null,
});

const EXERCISE_TOTALS = jsonResponse(200, {
  data: { entries: [], total_calories_burned: 300, total_duration_min: 30 },
  message: 'OK',
  error: null,
});

const UPSTREAM_ERROR = jsonResponse(500, {
  data: null,
  message: 'Internal server error',
  error: null,
});

describe('getDashboard', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aggregates profile, food, and exercise totals into the dashboard shape', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
      if (url.includes('/exercise/entries')) return Promise.resolve(EXERCISE_TOTALS);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getDashboard(AUTH_HEADER, { date: '2026-06-10' });

    expect(result).toEqual({
      date: '2026-06-10',
      calories: { consumed: 1800, burned: 300, net: 1500, target: 2200, remaining: 700 },
      protein_g: { consumed: 90 },
      bmr: 1500,
      tdee: 2200,
    });
  });

  it('computes negative net and remaining when burned exceeds consumed and target', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_FOUND);
      if (url.includes('/food/entries')) {
        return Promise.resolve(
          jsonResponse(200, {
            data: { entries: [], total_calories: 500, total_protein_g: 30 },
            message: 'OK',
            error: null,
          })
        );
      }
      if (url.includes('/exercise/entries')) {
        return Promise.resolve(
          jsonResponse(200, {
            data: { entries: [], total_calories_burned: 3000, total_duration_min: 120 },
            message: 'OK',
            error: null,
          })
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getDashboard(AUTH_HEADER, { date: '2026-06-10' });

    expect(result.calories.net).toBe(-2500);
    expect(result.calories.remaining).toBe(4700); // target (2200) - net (-2500)
  });

  it('returns null bmr/tdee/target/remaining when the profile is not found (404)', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
      if (url.includes('/exercise/entries')) return Promise.resolve(EXERCISE_TOTALS);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await getDashboard(AUTH_HEADER, { date: '2026-06-10' });

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
    const calledUrls: string[] = [];

    mockFetch.mockImplementation((url: string) => {
      calledUrls.push(url);
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
      return Promise.resolve(EXERCISE_TOTALS);
    });

    const result = await getDashboard(AUTH_HEADER, {});

    expect(result.date).toBe(today);
    expect(calledUrls.find((u) => u.includes('/food/entries'))).toContain(`date=${today}`);
    expect(calledUrls.find((u) => u.includes('/exercise/entries'))).toContain(`date=${today}`);
  });

  it('uses the provided date in food and exercise requests', async () => {
    const calledUrls: string[] = [];

    mockFetch.mockImplementation((url: string) => {
      calledUrls.push(url);
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
      return Promise.resolve(EXERCISE_TOTALS);
    });

    await getDashboard(AUTH_HEADER, { date: '2026-01-02' });

    expect(calledUrls.find((u) => u.includes('/food/entries'))).toContain('date=2026-01-02');
    expect(calledUrls.find((u) => u.includes('/exercise/entries'))).toContain('date=2026-01-02');
  });

  it('forwards the Authorization header to all three internal requests', async () => {
    const calledHeaders: Array<Record<string, string> | undefined> = [];

    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      calledHeaders.push(init?.headers as Record<string, string> | undefined);
      if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
      if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
      return Promise.resolve(EXERCISE_TOTALS);
    });

    await getDashboard(AUTH_HEADER, { date: '2026-06-10' });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    for (const headers of calledHeaders) {
      expect(headers).toMatchObject({ Authorization: AUTH_HEADER });
    }
  });

  describe('upstream errors', () => {
    it('throws a 502 AppError when the profile endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(UPSTREAM_ERROR);
        if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
        return Promise.resolve(EXERCISE_TOTALS);
      });

      await expect(getDashboard(AUTH_HEADER, { date: '2026-06-10' })).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch profile data',
      });
    });

    it('throws a 502 AppError when the food endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.resolve(UPSTREAM_ERROR);
        return Promise.resolve(EXERCISE_TOTALS);
      });

      await expect(getDashboard(AUTH_HEADER, { date: '2026-06-10' })).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch food data',
      });
    });

    it('throws a 502 AppError when the exercise endpoint returns a non-ok, non-404 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.resolve(FOOD_TOTALS);
        return Promise.resolve(UPSTREAM_ERROR);
      });

      await expect(getDashboard(AUTH_HEADER, { date: '2026-06-10' })).rejects.toMatchObject({
        status: 502,
        message: 'Failed to fetch exercise data',
      });
    });

    it('rejects when an internal fetch call itself fails (e.g. connection refused)', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/profile')) return Promise.resolve(PROFILE_NOT_FOUND);
        if (url.includes('/food/entries')) return Promise.reject(new TypeError('fetch failed'));
        return Promise.resolve(EXERCISE_TOTALS);
      });

      await expect(getDashboard(AUTH_HEADER, { date: '2026-06-10' })).rejects.toThrow(
        'fetch failed'
      );
    });
  });
});
