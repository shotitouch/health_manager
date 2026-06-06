import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { getProfileHandler, upsertProfileHandler } from './profile.controller.js';

const router = Router();

router.get('/profile', authMiddleware, getProfileHandler);
router.put('/profile', authMiddleware, upsertProfileHandler);

export default router;
