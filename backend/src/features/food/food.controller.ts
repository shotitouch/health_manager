import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logFoodEntry, getFoodEntries } from './food.service.js';
import { zodValidationError } from '../../shared/utils/validation.js';

const FoodEntrySchema = z.object({
  food_name: z.string().trim().min(1).max(200),
  calories: z.number().min(0).max(10000).finite(),
  protein_g: z.number().min(0).max(1000).finite().optional(),
  carbs_g: z.number().min(0).max(2000).finite().optional(),
  fat_g: z.number().min(0).max(1000).finite().optional(),
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

export async function logFoodEntryHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = FoodEntrySchema.safeParse(req.body);
    if (!parsed.success) throw zodValidationError(parsed.error.issues);

    const entry = await logFoodEntry(req.userId, parsed.data);
    res.status(201).json({ data: entry, message: 'Food entry logged', error: null });
  } catch (err) {
    next(err);
  }
}

export async function getFoodEntriesHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = GetEntriesQuerySchema.safeParse(req.query);
    if (!parsed.success) throw zodValidationError(parsed.error.issues);

    const result = await getFoodEntries(req.userId, parsed.data);
    res.json({ data: result, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}
