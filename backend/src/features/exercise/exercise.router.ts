import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { logExerciseEntryHandler, getExerciseEntriesHandler } from './exercise.controller.js';

const router = Router();

router.post('/exercise/entries', authMiddleware, logExerciseEntryHandler);
router.get('/exercise/entries', authMiddleware, getExerciseEntriesHandler);

export default router;
