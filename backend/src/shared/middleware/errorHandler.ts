import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  const status = err.status || 500;
  res.status(status).json({
    data: null,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
}
