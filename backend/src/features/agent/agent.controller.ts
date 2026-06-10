import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { runAgentLoop } from './agent.service.js';
import { AppError } from '../../shared/middleware/errorHandler.js';

// Image source uses a discriminated union so each source type enforces its own required fields.
const ImageContentBlockSchema = z.object({
  type: z.literal('image'),
  source: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('base64'),
      media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
      data: z.string().min(1),
    }),
    z.object({
      type: z.literal('url'),
      url: z.url(),
    }),
  ]),
});

const TextContentBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const ToolResultContentBlockSchema = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional(),
  is_error: z.boolean().optional(),
});

// tool_use blocks appear in assistant messages sent back by the frontend.
const ToolUseContentBlockSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

const ContentBlockSchema = z.union([
  ImageContentBlockSchema,
  TextContentBlockSchema,
  ToolResultContentBlockSchema,
  ToolUseContentBlockSchema,
]);

const AgentRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.union([z.string(), z.array(ContentBlockSchema)]),
      })
    )
    .min(1, 'messages must not be empty'),
});

export async function agentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = AgentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = Object.assign(
        new Error(
          parsed.error.issues
            .slice(0, 5)
            .map((i) => i.message)
            .join('; ')
        ),
        { status: 400 }
      ) as AppError;
      throw err;
    }

    const { messages } = parsed.data;
    const result = await runAgentLoop(messages as MessageParam[], req.userId);

    res.json({
      data: { messages: result.messages, feToolCalls: result.feToolCalls },
      message: 'OK',
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
