import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { getDashboardHandler } from './dashboard.controller.js';

const router = Router();

router.get('/dashboard', authMiddleware, getDashboardHandler);

export default router;
