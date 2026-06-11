import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getSummary } from './summary.service.js';
import { createHttpError } from '../../shared/middleware/errorHandler.js';
import { zodValidationError } from '../../shared/utils/validation.js';

// Date.parse rejects out-of-range months/days (e.g. month 13, day 00) but tolerates
// in-month rollovers (e.g. Feb 30 -> Mar 2) — good enough to keep countDays() from
// producing NaN without a full calendar-validation library.
function isValidCalendarDate(value: string): boolean {
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

const SummaryQuerySchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be in YYYY-MM-DD format')
      .refine(isValidCalendarDate, 'from must be a valid calendar date')
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be in YYYY-MM-DD format')
      .refine(isValidCalendarDate, 'to must be a valid calendar date')
      .optional(),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export async function getSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = SummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) throw zodValidationError(parsed.error.issues);

    const authHeader = req.headers.authorization;
    if (!authHeader) throw createHttpError('Unauthorized', 401);

    const result = await getSummary(authHeader, parsed.data);
    res.json({ data: result, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}
