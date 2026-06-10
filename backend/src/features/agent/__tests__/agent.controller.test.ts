import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import type { ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';

const STUB_USER_ID = 'user-123';

vi.mock('../agent.service.js', () => ({
  runAgentLoop: vi.fn(),
}));

vi.mock('../../../shared/middleware/auth.js', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = STUB_USER_ID;
    next();
  },
}));

import { runAgentLoop } from '../agent.service.js';
import agentRouter from '../agent.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockRunAgentLoop = vi.mocked(runAgentLoop);

const MOCK_RESULT = {
  messages: [{ role: 'user' as const, content: 'hi' }],
  feToolCalls: [
    {
      type: 'tool_use' as const,
      id: 'tu_1',
      name: 'display_message',
      input: { message: 'hi' },
    } as unknown as ToolUseBlock,
  ],
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', agentRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

const VALID_BODY = {
  messages: [{ role: 'user', content: 'hello' }],
};

describe('POST /api/v1/agent', () => {
  beforeEach(() => {
    mockRunAgentLoop.mockReset();
    mockRunAgentLoop.mockResolvedValue(MOCK_RESULT);
  });

  describe('valid requests', () => {
    it('returns 200 with data shape on valid body', async () => {
      const res = await request(app).post('/api/v1/agent').send(VALID_BODY);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: { messages: expect.any(Array), feToolCalls: expect.any(Array) },
        message: 'OK',
        error: null,
      });
    });

    it('accepts string content', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({ messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(200);
    });

    it('accepts text content block', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        });
      expect(res.status).toBe(200);
    });

    it('accepts valid base64 image content block', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png', data: 'abc123' },
                },
              ],
            },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('accepts valid url image content block', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'url', url: 'https://example.com/img.png' },
                },
              ],
            },
          ],
        });
      expect(res.status).toBe(200);
    });

    it('calls runAgentLoop with parsed messages and req.userId', async () => {
      await request(app).post('/api/v1/agent').send(VALID_BODY);
      expect(mockRunAgentLoop).toHaveBeenCalledWith(VALID_BODY.messages, STUB_USER_ID);
    });
  });

  describe('validation failures', () => {
    it('returns 400 when messages is empty array', async () => {
      const res = await request(app).post('/api/v1/agent').send({ messages: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when messages is missing', async () => {
      const res = await request(app).post('/api/v1/agent').send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when role is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({ messages: [{ role: 'system', content: 'hi' }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when base64 image source is missing data field', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/png' },
                },
              ],
            },
          ],
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when url image source has invalid url', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [
            {
              role: 'user',
              content: [{ type: 'image', source: { type: 'url', url: 'not-a-url' } }],
            },
          ],
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when content block has unknown type', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [{ role: 'user', content: [{ type: 'audio', data: 'abc' }] }],
        });
      expect(res.status).toBe(400);
    });
  });

  describe('service errors', () => {
    it('returns 500 when service throws an untyped error', async () => {
      mockRunAgentLoop.mockRejectedValue(new Error('Anthropic API down'));
      const res = await request(app).post('/api/v1/agent').send(VALID_BODY);
      expect(res.status).toBe(500);
    });

    it('propagates AppError status from service', async () => {
      const err = Object.assign(new Error('loop overflowed'), { status: 500 });
      mockRunAgentLoop.mockRejectedValue(err);
      const res = await request(app).post('/api/v1/agent').send(VALID_BODY);
      expect(res.status).toBe(500);
    });
  });
});
