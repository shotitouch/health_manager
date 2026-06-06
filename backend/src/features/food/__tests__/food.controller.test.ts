import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

const STUB_USER_ID = 'user-123';

vi.mock('../food.service.js', () => ({
  logFoodEntry: vi.fn(),
  getFoodEntries: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { logFoodEntry, getFoodEntries } from '../food.service.js';
import foodRouter from '../food.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockLogFoodEntry = vi.mocked(logFoodEntry);
const mockGetFoodEntries = vi.mocked(getFoodEntries);

const STUB_ENTRY = {
  id: 'stub-id-1',
  userId: STUB_USER_ID,
  food_name: 'Apple',
  calories: 95,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  logged_at: '2026-06-05T10:00:00.000Z',
};

const STUB_GET_RESULT = {
  entries: [STUB_ENTRY],
  total_calories: 95,
  total_protein_g: 0,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', foodRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const VALID_POST_BODY = {
  food_name: 'Apple',
  calories: 95,
};

describe('POST /api/v1/food/entries', () => {
  beforeEach(() => {
    mockLogFoodEntry.mockReset();
    mockLogFoodEntry.mockResolvedValue(STUB_ENTRY);
  });

  describe('valid requests', () => {
    it('returns 201 with the created entry', async () => {
      const res = await request(app).post('/api/v1/food/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        data: { id: expect.any(String), food_name: 'Apple', calories: 95 },
        message: 'Food entry logged',
        error: null,
      });
    });

    it('calls logFoodEntry with userId and parsed body', async () => {
      await request(app).post('/api/v1/food/entries').send(VALID_POST_BODY);
      expect(mockLogFoodEntry).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({ food_name: 'Apple', calories: 95 })
      );
    });

    it('accepts optional protein_g, carbs_g, fat_g', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, protein_g: 10, carbs_g: 20, fat_g: 5 });
      expect(res.status).toBe(201);
    });

    it('accepts optional logged_at string', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, logged_at: '2026-06-05T08:00:00.000Z' });
      expect(res.status).toBe(201);
    });
  });

  describe('validation failures', () => {
    it('returns 400 when food_name is missing', async () => {
      const { food_name: _, ...body } = VALID_POST_BODY;
      const res = await request(app).post('/api/v1/food/entries').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories is missing', async () => {
      const { calories: _, ...body } = VALID_POST_BODY;
      const res = await request(app).post('/api/v1/food/entries').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when food_name is empty string', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, food_name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when food_name exceeds 200 chars', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, food_name: 'a'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories is negative', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, calories: -1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories exceeds maximum', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, calories: 10001 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when protein_g is negative', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, protein_g: -5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when logged_at is not a valid ISO datetime', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, logged_at: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when food_name is whitespace only', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, food_name: '   ' });
      expect(res.status).toBe(400);
    });

    it('accepts calories of 0 (boundary)', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, calories: 0 });
      expect(res.status).toBe(201);
    });

    it('accepts calories of 10000 (boundary)', async () => {
      const res = await request(app)
        .post('/api/v1/food/entries')
        .send({ ...VALID_POST_BODY, calories: 10000 });
      expect(res.status).toBe(201);
    });
  });

  describe('service errors', () => {
    it('returns 500 when logFoodEntry throws an untyped error', async () => {
      mockLogFoodEntry.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/v1/food/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      mockLogFoodEntry.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
      const res = await request(app).post('/api/v1/food/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(409);
    });
  });
});

describe('GET /api/v1/food/entries', () => {
  beforeEach(() => {
    mockGetFoodEntries.mockReset();
    mockGetFoodEntries.mockResolvedValue(STUB_GET_RESULT);
  });

  describe('valid requests', () => {
    it('returns 200 with entries and totals when no date provided', async () => {
      const res = await request(app).get('/api/v1/food/entries');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: {
          entries: expect.any(Array),
          total_calories: expect.any(Number),
          total_protein_g: expect.any(Number),
        },
        message: 'OK',
        error: null,
      });
    });

    it('returns 200 when a valid date is provided', async () => {
      const res = await request(app).get('/api/v1/food/entries?date=2026-06-05');
      expect(res.status).toBe(200);
    });

    it('calls getFoodEntries with userId and date when provided', async () => {
      await request(app).get('/api/v1/food/entries?date=2026-06-05');
      expect(mockGetFoodEntries).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({ date: '2026-06-05' })
      );
    });

    it('calls getFoodEntries with userId and no date when omitted', async () => {
      await request(app).get('/api/v1/food/entries');
      expect(mockGetFoodEntries).toHaveBeenCalledWith(STUB_USER_ID, expect.objectContaining({}));
    });
  });

  describe('validation failures', () => {
    it('returns 400 when date format is invalid', async () => {
      const res = await request(app).get('/api/v1/food/entries?date=not-a-date');
      expect(res.status).toBe(400);
    });

    it('returns 400 when date is in wrong format (MM/DD/YYYY)', async () => {
      const res = await request(app).get('/api/v1/food/entries?date=06/05/2026');
      expect(res.status).toBe(400);
    });
  });

  describe('service errors', () => {
    it('returns 500 when getFoodEntries throws an untyped error', async () => {
      mockGetFoodEntries.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/v1/food/entries');
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      mockGetFoodEntries.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
      const res = await request(app).get('/api/v1/food/entries');
      expect(res.status).toBe(404);
    });
  });
});
