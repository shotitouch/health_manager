import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDashboard } from './dashboard.service.js';
import { createHttpError } from '../../shared/middleware/errorHandler.js';
import { zodValidationError } from '../../shared/utils/validation.js';

const DashboardQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
    .optional(),
});

export async function getDashboardHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = DashboardQuerySchema.safeParse(req.query);
    if (!parsed.success) throw zodValidationError(parsed.error.issues);

    const authHeader = req.headers.authorization;
    if (!authHeader) throw createHttpError('Unauthorized', 401);

    const result = await getDashboard(authHeader, parsed.data);
    res.json({ data: result, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}
