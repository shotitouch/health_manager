import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { logger } from './shared/middleware/logger.js';
import agentRouter from './features/agent/agent.router.js';
import authRouter from './features/auth/auth.router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(logger);

app.get('/api/v1/health', (req, res) => {
  res.json({
    data: { status: 'ok', timestamp: new Date().toISOString() },
    message: 'Healthy',
    error: null,
  });
});

app.use('/api/v1', authRouter);
app.use('/api/v1', agentRouter);

app.use(errorHandler);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');
  }
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
