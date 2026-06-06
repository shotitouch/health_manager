import { Router } from 'express';
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from './auth.controller.js';

const router = Router();

router.post('/auth/register', registerHandler);
router.post('/auth/login', loginHandler);
router.post('/auth/refresh', refreshHandler);
router.post('/auth/logout', logoutHandler);

export default router;
