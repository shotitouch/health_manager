import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

const STUB_USER_ID = 'user-123';

vi.mock('../dashboard.service.js', () => ({
  getDashboard: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { getDashboard } from '../dashboard.service.js';
import dashboardRouter from '../dashboard.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockGetDashboard = vi.mocked(getDashboard);

const STUB_DASHBOARD = {
  date: '2026-06-10',
  calories: { consumed: 1800, burned: 300, net: 1500, target: 2200, remaining: 700 },
  protein_g: { consumed: 90 },
  bmr: 1500,
  tdee: 2200,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', dashboardRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('GET /api/v1/dashboard', () => {
  beforeEach(() => {
    mockGetDashboard.mockReset();
    mockGetDashboard.mockResolvedValue(STUB_DASHBOARD);
  });

  describe('valid requests', () => {
    it('returns 200 with the dashboard rollup when no date is provided', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: STUB_DASHBOARD,
        message: 'OK',
        error: null,
      });
    });

    it('calls getDashboard with the auth header and no date when omitted', async () => {
      await request(app).get('/api/v1/dashboard').set('Authorization', 'Bearer test-token');

      expect(mockGetDashboard).toHaveBeenCalledWith(
        'Bearer test-token',
        expect.objectContaining({})
      );
      const [, input] = mockGetDashboard.mock.calls[0];
      expect(input.date).toBeUndefined();
    });

    it('returns 200 when a valid date is provided', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard?date=2026-06-10')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
    });

    it('calls getDashboard with the parsed date when provided', async () => {
      await request(app)
        .get('/api/v1/dashboard?date=2026-06-10')
        .set('Authorization', 'Bearer test-token');

      expect(mockGetDashboard).toHaveBeenCalledWith('Bearer test-token', { date: '2026-06-10' });
    });

    it('forwards the exact Authorization header value to the service', async () => {
      await request(app).get('/api/v1/dashboard').set('Authorization', 'Bearer abc.def.ghi');

      expect(mockGetDashboard).toHaveBeenCalledWith('Bearer abc.def.ghi', expect.anything());
    });
  });

  describe('validation failures', () => {
    it('returns 400 when date format is invalid (MM/DD/YYYY)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard?date=06/10/2026')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
    });

    it('returns 400 when date is not a date string', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard?date=not-a-date')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
    });

    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/dashboard');

      expect(res.status).toBe(401);
      expect(mockGetDashboard).not.toHaveBeenCalled();
    });
  });

  describe('service errors', () => {
    it('returns 500 when getDashboard throws an untyped error', async () => {
      mockGetDashboard.mockRejectedValue(new Error('boom'));

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service (e.g. upstream failure)', async () => {
      mockGetDashboard.mockRejectedValue(
        Object.assign(new Error('Failed to fetch food data'), { status: 502 })
      );

      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(502);
    });
  });
});
