import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler, type AppError } from '../middleware/errorHandler.js';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const req = {} as Request;
const next = vi.fn() as unknown as NextFunction;

describe('errorHandler', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
  });

  it('uses AppError.status as HTTP status code', () => {
    const res = makeRes();
    const err: AppError = Object.assign(new Error('not found'), { status: 404 });
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('defaults to 500 when no status is set', () => {
    const res = makeRes();
    errorHandler(new Error('boom'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('includes the error message in the response body', () => {
    const res = makeRes();
    const err: AppError = Object.assign(new Error('bad request'), { status: 400 });
    errorHandler(err, req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad request' }));
  });

  it('sets data to null in the response body', () => {
    const res = makeRes();
    errorHandler(new Error('x'), req, res, next);
    const body: { data: unknown } = res.json.mock.calls[0][0];
    expect(body.data).toBeNull();
  });

  it('includes stack trace in error field when NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    const err = new Error('debug me');
    errorHandler(err, req, res, next);
    const body: { error: unknown } = res.json.mock.calls[0][0];
    expect(body.error).toBeTruthy();
    expect(typeof body.error).toBe('string');
  });

  it('sets error field to null when NODE_ENV=production', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    errorHandler(new Error('hidden'), req, res, next);
    const body: { error: unknown } = res.json.mock.calls[0][0];
    expect(body.error).toBeNull();
  });

  it('sets error field to null when NODE_ENV is unset', () => {
    const res = makeRes();
    errorHandler(new Error('unset env'), req, res, next);
    const body: { error: unknown } = res.json.mock.calls[0][0];
    expect(body.error).toBeNull();
  });
});
