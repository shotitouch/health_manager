import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { register, login, refreshAccessToken } from './auth.service.js';
import { AppError, createHttpError } from '../../shared/middleware/errorHandler.js';

const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};
const CLEAR_COOKIE_OPTIONS = {
  httpOnly: COOKIE_OPTIONS.httpOnly,
  sameSite: COOKIE_OPTIONS.sameSite,
  secure: COOKIE_OPTIONS.secure,
};

function validationError(issues: z.ZodIssue[]): AppError {
  return createHttpError(issues.map((i) => i.message).join('; '), 400);
}

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const { email, password, name } = parsed.data;
    const result = await register(email, password, name);

    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.json({
      data: { accessToken: result.accessToken, user: result.user },
      message: 'Registered',
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const { email, password } = parsed.data;
    const result = await login(email, password);

    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.json({
      data: { accessToken: result.accessToken, user: result.user },
      message: 'OK',
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw createHttpError('Refresh token missing', 401);
    }

    const result = await refreshAccessToken(token);

    // Rotate the refresh cookie so a stolen token becomes invalid after the next use.
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTIONS);
    res.json({ data: { accessToken: result.accessToken }, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE, CLEAR_COOKIE_OPTIONS);
  res.json({ data: null, message: 'OK', error: null });
}
