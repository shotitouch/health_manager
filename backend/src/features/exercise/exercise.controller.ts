import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logExerciseEntry, getExerciseEntries } from './exercise.service.js';
import { AppError, createHttpError } from '../../shared/middleware/errorHandler.js';

const ExerciseEntrySchema = z.object({
  exercise_name: z.string().trim().min(1).max(200),
  calories_burned: z.number().min(0).max(10000).finite(),
  duration_min: z.number().min(0).max(1440).finite().optional(),
  logged_at: z
    .string()
    .datetime({ message: 'logged_at must be a valid ISO 8601 datetime' })
    .optional(),
});

const GetEntriesQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
    .optional(),
});

function validationError(issues: z.ZodIssue[]): AppError {
  return createHttpError(
    issues.map((i) => `${i.path.join('.') || 'value'}: ${i.code}`).join('; '),
    400
  );
}

export async function logExerciseEntryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = ExerciseEntrySchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const entry = await logExerciseEntry(req.userId, parsed.data);
    res.status(201).json({ data: entry, message: 'Exercise entry logged', error: null });
  } catch (err) {
    next(err);
  }
}

export async function getExerciseEntriesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = GetEntriesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const result = await getExerciseEntries(req.userId, parsed.data);
    res.json({ data: result, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}
