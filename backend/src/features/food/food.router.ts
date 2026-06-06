import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { logFoodEntryHandler, getFoodEntriesHandler } from './food.controller.js';

const router = Router();

router.post('/food/entries', authMiddleware, logFoodEntryHandler);
router.get('/food/entries', authMiddleware, getFoodEntriesHandler);

export default router;
