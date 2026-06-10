import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

const STUB_USER_ID = 'user-123';

vi.mock('../exercise.service.js', () => ({
  logExerciseEntry: vi.fn(),
  getExerciseEntries: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { logExerciseEntry, getExerciseEntries } from '../exercise.service.js';
import exerciseRouter from '../exercise.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockLogExerciseEntry = vi.mocked(logExerciseEntry);
const mockGetExerciseEntries = vi.mocked(getExerciseEntries);

const STUB_ENTRY = {
  id: 'stub-id-1',
  userId: STUB_USER_ID,
  exercise_name: 'Running',
  calories_burned: 300,
  duration_min: 30,
  logged_at: '2026-06-05T10:00:00.000Z',
};

const STUB_GET_RESULT = {
  entries: [STUB_ENTRY],
  total_calories_burned: 300,
  total_duration_min: 30,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', exerciseRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const VALID_POST_BODY = {
  exercise_name: 'Running',
  calories_burned: 300,
};

describe('POST /api/v1/exercise/entries', () => {
  beforeEach(() => {
    mockLogExerciseEntry.mockReset();
    mockLogExerciseEntry.mockResolvedValue(STUB_ENTRY);
  });

  describe('valid requests', () => {
    it('returns 201 with the created entry', async () => {
      const res = await request(app).post('/api/v1/exercise/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        data: { id: expect.any(String), exercise_name: 'Running', calories_burned: 300 },
        message: 'Exercise entry logged',
        error: null,
      });
    });

    it('calls logExerciseEntry with userId and parsed body', async () => {
      await request(app).post('/api/v1/exercise/entries').send(VALID_POST_BODY);
      expect(mockLogExerciseEntry).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({ exercise_name: 'Running', calories_burned: 300 })
      );
    });

    it('accepts optional duration_min', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, duration_min: 45 });
      expect(res.status).toBe(201);
    });

    it('accepts optional logged_at string', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, logged_at: '2026-06-05T08:00:00.000Z' });
      expect(res.status).toBe(201);
    });
  });

  describe('validation failures', () => {
    it('returns 400 when exercise_name is missing', async () => {
      const { exercise_name: _, ...body } = VALID_POST_BODY;
      const res = await request(app).post('/api/v1/exercise/entries').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories_burned is missing', async () => {
      const { calories_burned: _, ...body } = VALID_POST_BODY;
      const res = await request(app).post('/api/v1/exercise/entries').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when exercise_name is empty string', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, exercise_name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when exercise_name is whitespace only', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, exercise_name: '   ' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when exercise_name exceeds 200 chars', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, exercise_name: 'a'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories_burned is negative', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, calories_burned: -1 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when calories_burned exceeds maximum', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, calories_burned: 10001 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when duration_min is negative', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, duration_min: -5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when duration_min exceeds maximum', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, duration_min: 1441 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when logged_at is not a valid ISO datetime', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, logged_at: 'not-a-date' });
      expect(res.status).toBe(400);
    });

    it('accepts calories_burned of 0 (boundary)', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, calories_burned: 0 });
      expect(res.status).toBe(201);
    });

    it('accepts calories_burned of 10000 (boundary)', async () => {
      const res = await request(app)
        .post('/api/v1/exercise/entries')
        .send({ ...VALID_POST_BODY, calories_burned: 10000 });
      expect(res.status).toBe(201);
    });
  });

  describe('service errors', () => {
    it('returns 500 when logExerciseEntry throws an untyped error', async () => {
      mockLogExerciseEntry.mockRejectedValue(new Error('DB error'));
      const res = await request(app).post('/api/v1/exercise/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      mockLogExerciseEntry.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
      const res = await request(app).post('/api/v1/exercise/entries').send(VALID_POST_BODY);
      expect(res.status).toBe(409);
    });
  });
});

describe('GET /api/v1/exercise/entries', () => {
  beforeEach(() => {
    mockGetExerciseEntries.mockReset();
    mockGetExerciseEntries.mockResolvedValue(STUB_GET_RESULT);
  });

  describe('valid requests', () => {
    it('returns 200 with entries and totals when no date provided', async () => {
      const res = await request(app).get('/api/v1/exercise/entries');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: {
          entries: expect.any(Array),
          total_calories_burned: expect.any(Number),
          total_duration_min: expect.any(Number),
        },
        message: 'OK',
        error: null,
      });
    });

    it('returns 200 when a valid date is provided', async () => {
      const res = await request(app).get('/api/v1/exercise/entries?date=2026-06-05');
      expect(res.status).toBe(200);
    });

    it('calls getExerciseEntries with userId and date when provided', async () => {
      await request(app).get('/api/v1/exercise/entries?date=2026-06-05');
      expect(mockGetExerciseEntries).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({ date: '2026-06-05' })
      );
    });

    it('calls getExerciseEntries with userId and no date when omitted', async () => {
      await request(app).get('/api/v1/exercise/entries');
      expect(mockGetExerciseEntries).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({})
      );
    });
  });

  describe('validation failures', () => {
    it('returns 400 when date format is invalid', async () => {
      const res = await request(app).get('/api/v1/exercise/entries?date=not-a-date');
      expect(res.status).toBe(400);
    });

    it('returns 400 when date is in wrong format (MM/DD/YYYY)', async () => {
      const res = await request(app).get('/api/v1/exercise/entries?date=06/05/2026');
      expect(res.status).toBe(400);
    });
  });

  describe('service errors', () => {
    it('returns 500 when getExerciseEntries throws an untyped error', async () => {
      mockGetExerciseEntries.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/api/v1/exercise/entries');
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      mockGetExerciseEntries.mockRejectedValue(
        Object.assign(new Error('not found'), { status: 404 })
      );
      const res = await request(app).get('/api/v1/exercise/entries');
      expect(res.status).toBe(404);
    });
  });
});
