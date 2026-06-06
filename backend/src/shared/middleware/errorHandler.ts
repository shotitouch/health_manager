import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
}

export function createHttpError(message: string, status: number): AppError {
  const err = new Error(message) as AppError;
  err.status = status;
  return err;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const status = err.status || 500;
  const message = status >= 500 ? 'Internal server error' : err.message || 'Internal server error';
  res.status(status).json({
    data: null,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
}
