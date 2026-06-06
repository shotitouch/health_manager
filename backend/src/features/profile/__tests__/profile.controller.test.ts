import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

const STUB_USER_ID = 'user-123';

vi.mock('../profile.service.js', () => ({
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { getProfile, upsertProfile } from '../profile.service.js';
import profileRouter from '../profile.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockGetProfile = vi.mocked(getProfile);
const mockUpsertProfile = vi.mocked(upsertProfile);

const STUB_PROFILE = {
  userId: STUB_USER_ID,
  age: 30,
  sex: 'male' as const,
  weight_kg: 75,
  height_cm: 175,
  activity_level: 'moderate' as const,
  bmr: 1699,
  tdee: 2633,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', profileRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const VALID_PUT_BODY = {
  age: 30,
  sex: 'male',
  weight_kg: 75,
  height_cm: 175,
  activity_level: 'moderate',
};

describe('GET /api/v1/profile', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    mockGetProfile.mockResolvedValue(null);
  });

  it('returns 404 when profile does not exist', async () => {
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(404);
  });

  it('calls getProfile with the userId from middleware', async () => {
    await request(app).get('/api/v1/profile');
    expect(mockGetProfile).toHaveBeenCalledWith(STUB_USER_ID);
  });

  it('returns 500 when getProfile throws', async () => {
    mockGetProfile.mockRejectedValue(Object.assign(new Error('DB error'), { status: 500 }));
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/profile', () => {
  beforeEach(() => {
    mockUpsertProfile.mockReset();
    mockUpsertProfile.mockResolvedValue(STUB_PROFILE);
  });

  describe('valid requests', () => {
    it('returns 200 with profile data on valid body', async () => {
      const res = await request(app).put('/api/v1/profile').send(VALID_PUT_BODY);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { bmr: expect.any(Number), tdee: expect.any(Number) },
        message: 'OK',
        error: null,
      });
      expect(res.body.data).not.toHaveProperty('userId');
    });

    it('accepts optional name field', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, name: 'Alice' });
      expect(res.status).toBe(200);
    });

    it('accepts optional goal field', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, goal: 'lose' });
      expect(res.status).toBe(200);
    });

    it('accepts female sex', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, sex: 'female' });
      expect(res.status).toBe(200);
    });

    it('calls upsertProfile with userId and parsed body', async () => {
      await request(app).put('/api/v1/profile').send(VALID_PUT_BODY);
      expect(mockUpsertProfile).toHaveBeenCalledWith(
        STUB_USER_ID,
        expect.objectContaining({
          age: 30,
          sex: 'male',
          weight_kg: 75,
          height_cm: 175,
          activity_level: 'moderate',
        })
      );
    });
  });

  describe('validation failures', () => {
    it('returns 400 when age is missing', async () => {
      const { age: _, ...body } = VALID_PUT_BODY;
      const res = await request(app).put('/api/v1/profile').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when sex is missing', async () => {
      const { sex: _, ...body } = VALID_PUT_BODY;
      const res = await request(app).put('/api/v1/profile').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when weight_kg is missing', async () => {
      const { weight_kg: _, ...body } = VALID_PUT_BODY;
      const res = await request(app).put('/api/v1/profile').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when height_cm is missing', async () => {
      const { height_cm: _, ...body } = VALID_PUT_BODY;
      const res = await request(app).put('/api/v1/profile').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when activity_level is missing', async () => {
      const { activity_level: _, ...body } = VALID_PUT_BODY;
      const res = await request(app).put('/api/v1/profile').send(body);
      expect(res.status).toBe(400);
    });

    it('returns 400 when age is 0', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, age: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when age is 121', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, age: 121 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when sex is invalid', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, sex: 'other' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when activity_level is invalid', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, activity_level: 'extreme' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when weight_kg is negative', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, weight_kg: -5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when height_cm is zero', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, height_cm: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when name exceeds 100 chars', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, name: 'a'.repeat(101) });
      expect(res.status).toBe(400);
    });

    it('returns 400 when goal is invalid', async () => {
      const res = await request(app)
        .put('/api/v1/profile')
        .send({ ...VALID_PUT_BODY, goal: 'bulk' });
      expect(res.status).toBe(400);
    });
  });

  describe('service errors', () => {
    it('returns 500 when upsertProfile throws an untyped error', async () => {
      mockUpsertProfile.mockRejectedValue(new Error('DB error'));
      const res = await request(app).put('/api/v1/profile').send(VALID_PUT_BODY);
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      mockUpsertProfile.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
      const res = await request(app).put('/api/v1/profile').send(VALID_PUT_BODY);
      expect(res.status).toBe(409);
    });
  });
});
