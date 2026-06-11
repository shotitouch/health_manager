import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';

const STUB_USER_ID = 'user-123';

vi.mock('../summary.service.js', () => ({
  getSummary: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { getSummary } from '../summary.service.js';
import summaryRouter from '../summary.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockGetSummary = vi.mocked(getSummary);

const STUB_SUMMARY = {
  from: '2026-06-05',
  to: '2026-06-11',
  days: 7,
  calories: {
    consumed_total: 12600,
    burned_total: 2100,
    net_total: 10500,
    consumed_avg: 1800,
    burned_avg: 300,
    net_avg: 1500,
    target_total: 15400,
    remaining_total: 4900,
  },
  protein_g: {
    consumed_total: 630,
    consumed_avg: 90,
  },
  bmr: 1500,
  tdee: 2200,
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', summaryRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('GET /api/v1/summary', () => {
  beforeEach(() => {
    mockGetSummary.mockReset();
    mockGetSummary.mockResolvedValue(STUB_SUMMARY);
  });

  describe('valid requests', () => {
    it('returns 200 with the summary when no query params are provided', async () => {
      const res = await request(app)
        .get('/api/v1/summary')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: STUB_SUMMARY,
        message: 'OK',
        error: null,
      });
    });

    it('calls getSummary with the auth header and no from/to when omitted', async () => {
      await request(app).get('/api/v1/summary').set('Authorization', 'Bearer test-token');

      expect(mockGetSummary).toHaveBeenCalledWith('Bearer test-token', expect.objectContaining({}));
      const [, input] = mockGetSummary.mock.calls[0];
      expect(input.from).toBeUndefined();
      expect(input.to).toBeUndefined();
    });

    it('returns 200 when valid from and to are provided', async () => {
      const res = await request(app)
        .get('/api/v1/summary?from=2026-06-05&to=2026-06-11')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
    });

    it('calls getSummary with the parsed from/to when provided', async () => {
      await request(app)
        .get('/api/v1/summary?from=2026-06-05&to=2026-06-11')
        .set('Authorization', 'Bearer test-token');

      expect(mockGetSummary).toHaveBeenCalledWith('Bearer test-token', {
        from: '2026-06-05',
        to: '2026-06-11',
      });
    });

    it('forwards the exact Authorization header value to the service', async () => {
      await request(app).get('/api/v1/summary').set('Authorization', 'Bearer abc.def.ghi');

      expect(mockGetSummary).toHaveBeenCalledWith('Bearer abc.def.ghi', expect.anything());
    });
  });

  describe('validation failures', () => {
    it('returns 400 when from format is invalid (MM/DD/YYYY)', async () => {
      const res = await request(app)
        .get('/api/v1/summary?from=06/05/2026')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });

    it('returns 400 when to format is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/summary?to=not-a-date')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });

    it('returns 400 when from is after to', async () => {
      const res = await request(app)
        .get('/api/v1/summary?from=2026-06-11&to=2026-06-05')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });

    it('returns 400 when from is not a valid calendar date (e.g. month 13)', async () => {
      const res = await request(app)
        .get('/api/v1/summary?from=2026-13-01')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });

    it('returns 400 when to is not a valid calendar date (e.g. day 00)', async () => {
      const res = await request(app)
        .get('/api/v1/summary?to=2026-06-00')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(400);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });

    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app).get('/api/v1/summary');

      expect(res.status).toBe(401);
      expect(mockGetSummary).not.toHaveBeenCalled();
    });
  });

  describe('service errors', () => {
    it('returns 500 when getSummary throws an untyped error', async () => {
      mockGetSummary.mockRejectedValue(new Error('boom'));

      const res = await request(app)
        .get('/api/v1/summary')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service (e.g. upstream failure)', async () => {
      mockGetSummary.mockRejectedValue(
        Object.assign(new Error('Failed to fetch food data'), { status: 502 })
      );

      const res = await request(app)
        .get('/api/v1/summary')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(502);
    });
  });
});
