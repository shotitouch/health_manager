import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';

vi.mock('../auth.service.js', () => ({
  register: vi.fn(),
  login: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

import { register, login, refreshAccessToken } from '../auth.service.js';
import authRouter from '../auth.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockRegister = vi.mocked(register);
const mockLogin = vi.mocked(login);
const mockRefreshAccessToken = vi.mocked(refreshAccessToken);

const STUB_RESULT = {
  accessToken: 'access.token.stub',
  refreshToken: 'refresh.token.stub',
  user: { id: 'stub-user-id', email: 'test@example.com' },
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1', authRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockRegister.mockResolvedValue(STUB_RESULT);
  });

  it('returns 200 with accessToken and user on valid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        accessToken: expect.any(String),
        user: { id: expect.any(String), email: expect.any(String) },
      },
      message: expect.any(String),
      error: null,
    });
  });

  it('sets refreshToken httpOnly cookie on success', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refreshToken=')
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
  });

  it('accepts optional name field', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Alice' });

    expect(res.status).toBe(200);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockRegister.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockLogin.mockResolvedValue(STUB_RESULT);
  });

  it('returns 200 with accessToken and user on valid body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: {
        accessToken: expect.any(String),
        user: { id: expect.any(String), email: expect.any(String) },
      },
      message: expect.any(String),
      error: null,
    });
  });

  it('sets refreshToken httpOnly cookie on success', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refreshToken=')
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bad', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockLogin.mockRejectedValue(new Error('credentials invalid'));
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => {
    mockRefreshAccessToken.mockReset();
    mockRefreshAccessToken.mockResolvedValue({
      accessToken: 'new.access.token',
      refreshToken: 'new.refresh.token',
    });
  });

  it('returns 200 with new accessToken when valid cookie present', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=valid.refresh.token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { accessToken: expect.any(String) },
      message: expect.any(String),
      error: null,
    });
  });

  it('rotates the refreshToken cookie on success', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=valid.refresh.token');

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const rotated = cookies?.find((c) => c.startsWith('refreshToken='));
    expect(rotated).toBeDefined();
    expect(rotated).toContain('HttpOnly');
  });

  it('returns 401 when refreshToken cookie is absent', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('returns 500 when service throws', async () => {
    mockRefreshAccessToken.mockRejectedValue(
      Object.assign(new Error('invalid token'), { status: 401 })
    );
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=bad.token');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('returns 200 and clears the refreshToken cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refreshToken=some.token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: null, message: expect.any(String), error: null });

    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cleared = cookies?.find((c) => c.startsWith('refreshToken='));
    // Cookie cleared = value is empty or Expires is in the past
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/refreshToken=;|refreshToken=$/);
  });
});
