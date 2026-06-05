import { Router } from 'express';
import { agentHandler } from './agent.controller.js';

const router = Router();

router.post('/agent', agentHandler);

export default router;
