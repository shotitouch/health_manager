import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { getSummaryHandler } from './summary.controller.js';

const router = Router();

router.get('/summary', authMiddleware, getSummaryHandler);

export default router;
