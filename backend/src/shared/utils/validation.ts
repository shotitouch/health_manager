import { z } from 'zod';
import { AppError, createHttpError } from '../middleware/errorHandler.js';

export function zodValidationError(issues: z.ZodIssue[]): AppError {
  return createHttpError(
    issues.map((i) => `${i.path.join('.') || 'value'}: ${i.code}`).join('; '),
    400
  );
}
