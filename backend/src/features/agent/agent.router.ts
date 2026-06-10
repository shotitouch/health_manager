import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import { agentHandler } from './agent.controller.js';

const router = Router();

router.post('/agent', authMiddleware, agentHandler);

export default router;
