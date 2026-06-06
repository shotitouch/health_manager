import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHttpError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

function isAccessPayload(v: unknown): v is { userId: string } {
  return (
    typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).userId === 'string'
  );
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(createHttpError('Unauthorized', 401));
    return;
  }

  const token = authHeader.slice(7);
  try {
    const raw = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    if (!isAccessPayload(raw)) {
      next(createHttpError('Invalid token payload', 401));
      return;
    }
    req.userId = raw.userId;
    next();
  } catch (err) {
    console.warn(
      'authMiddleware: token verification failed:',
      err instanceof Error ? err.constructor.name : 'unknown'
    );
    next(createHttpError('Invalid or expired token', 401));
  }
}
