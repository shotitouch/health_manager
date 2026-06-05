import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../agent.service.js', () => ({
  runAgentLoop: vi.fn(),
}));

import { runAgentLoop } from '../agent.service.js';
import agentRouter from '../agent.router.js';
import { errorHandler } from '../../../shared/middleware/errorHandler.js';

const mockRunAgentLoop = vi.mocked(runAgentLoop);

const MOCK_RESULT = {
  messages: [{ role: 'user' as const, content: 'hi' }],
  feToolCalls: [
    { type: 'tool_use' as const, id: 'tu_1', name: 'display_message', input: { message: 'hi' } },
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
  userId: 'user-123',
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
        .send({ messages: [{ role: 'user', content: 'hi' }], userId: 'u1' });
      expect(res.status).toBe(200);
    });

    it('accepts text content block', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
          userId: 'u1',
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
          userId: 'u1',
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
          userId: 'u1',
        });
      expect(res.status).toBe(200);
    });

    it('calls runAgentLoop with parsed messages and userId', async () => {
      await request(app).post('/api/v1/agent').send(VALID_BODY);
      expect(mockRunAgentLoop).toHaveBeenCalledWith(VALID_BODY.messages, VALID_BODY.userId);
    });
  });

  describe('validation failures', () => {
    it('returns 400 when userId is missing', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({ messages: [{ role: 'user', content: 'hi' }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when userId is empty string', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({ messages: [{ role: 'user', content: 'hi' }], userId: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when messages is empty array', async () => {
      const res = await request(app).post('/api/v1/agent').send({ messages: [], userId: 'u1' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when messages is missing', async () => {
      const res = await request(app).post('/api/v1/agent').send({ userId: 'u1' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when role is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({ messages: [{ role: 'system', content: 'hi' }], userId: 'u1' });
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
          userId: 'u1',
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
          userId: 'u1',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 when content block has unknown type', async () => {
      const res = await request(app)
        .post('/api/v1/agent')
        .send({
          messages: [{ role: 'user', content: [{ type: 'audio', data: 'abc' }] }],
          userId: 'u1',
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
