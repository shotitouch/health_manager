import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getProfile, upsertProfile } from './profile.service.js';
import { AppError, createHttpError } from '../../shared/middleware/errorHandler.js';

const ProfileSchema = z.object({
  name: z.string().max(100).optional(),
  age: z.number().int().min(1).max(120),
  sex: z.enum(['male', 'female']),
  weight_kg: z.number().positive().finite(),
  height_cm: z.number().positive().finite(),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']).optional(),
});

function validationError(issues: z.ZodIssue[]): AppError {
  return createHttpError(issues.map((i) => i.message).join('; '), 400);
}

export async function getProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await getProfile(req.userId);
    if (profile === null) {
      return next(createHttpError('Profile not found', 404));
    }
    res.json({ data: { profile }, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}

export async function upsertProfileHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = ProfileSchema.safeParse(req.body);
    if (!parsed.success) throw validationError(parsed.error.issues);

    const { userId: _uid, ...profileData } = await upsertProfile(req.userId, parsed.data);
    res.json({ data: profileData, message: 'OK', error: null });
  } catch (err) {
    next(err);
  }
}
