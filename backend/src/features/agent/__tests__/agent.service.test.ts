import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.hoisted runs before module init so the mock factory can reference this variable.
const mockMessagesCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  // Must be a class (not an arrow fn) so `new Anthropic()` works as a constructor.
  default: class {
    messages = { create: mockMessagesCreate };
  },
}));

import { runAgentLoop } from '../agent.service.js';

// ---------------------------------------------------------------------------
// Fixtures — minimal Anthropic API response shapes.
// ---------------------------------------------------------------------------

function apiResponse(content: object[], stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content,
    stop_reason: stopReason,
    model: 'claude-test',
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

const ROUTER_SKIP_WORKER = apiResponse(
  [
    {
      type: 'tool_use',
      id: 'tu_r1',
      name: 'classify_intent',
      input: { intent: 'navigate', hasImage: false, skipWorker: true },
    },
  ],
  'tool_use'
);

const ROUTER_NEEDS_WORKER = apiResponse(
  [
    {
      type: 'tool_use',
      id: 'tu_r2',
      name: 'classify_intent',
      input: { intent: 'log_food', hasImage: false, skipWorker: false },
    },
  ],
  'tool_use'
);

const WORKER_END_TURN = apiResponse([{ type: 'text', text: 'Data processed.' }], 'end_turn');

const WORKER_LOOPS_GET_USER_LOG = apiResponse(
  [{ type: 'tool_use', id: 'tu_w_stub', name: 'get_user_log', input: {} }],
  'tool_use'
);

const WORKER_CALLS_USDA = apiResponse(
  [
    {
      type: 'tool_use',
      id: 'tu_w_usda',
      name: 'search_nutrition_usda',
      input: { query: 'chicken breast' },
    },
  ],
  'tool_use'
);

const PRESENTER_SHOW_DASHBOARD = apiResponse(
  [{ type: 'tool_use', id: 'tu_p1', name: 'show_dashboard', input: {} }],
  'tool_use'
);

const PRESENTER_SHOW_FOOD_INPUT = apiResponse(
  [
    {
      type: 'tool_use',
      id: 'tu_p2',
      name: 'show_food_input',
      input: { prefill: { name: 'Rice', calories: 130 } },
    },
  ],
  'tool_use'
);

const PRESENTER_NO_TOOL_CALLS = apiResponse([{ type: 'text', text: 'Cannot help.' }], 'end_turn');

const USER_MESSAGES = [{ role: 'user' as const, content: 'I ate rice' }];

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('runAgentLoop', () => {
  beforeEach(() => {
    mockMessagesCreate.mockReset();
    vi.unstubAllGlobals();
    delete process.env.USDA_API_KEY;
  });

  describe('routing — skipWorker=true', () => {
    it('makes exactly 2 SDK calls: router then presenter', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_SKIP_WORKER)
        .mockResolvedValueOnce(PRESENTER_SHOW_DASHBOARD);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
    });

    it('returns the FE tool call from the presenter', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_SKIP_WORKER)
        .mockResolvedValueOnce(PRESENTER_SHOW_DASHBOARD);

      const result = await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(result.feToolCalls).toHaveLength(1);
      expect(result.feToolCalls[0]).toMatchObject({ type: 'tool_use', name: 'show_dashboard' });
    });

    it('returns a non-empty messages array', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_SKIP_WORKER)
        .mockResolvedValueOnce(PRESENTER_SHOW_DASHBOARD);

      const result = await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(result.messages.length).toBeGreaterThan(0);
    });
  });

  describe('routing — skipWorker=false', () => {
    it('makes exactly 3 SDK calls: router, worker, presenter', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(mockMessagesCreate).toHaveBeenCalledTimes(3);
    });

    it('returns the correct FE tool from presenter', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      const result = await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(result.feToolCalls[0].name).toBe('show_food_input');
    });

    it('sends a message list ending in a synthetic user handoff to the presenter (Anthropic rejects assistant-ending input)', async () => {
      // mock.calls stores a live array reference that runPresenterLoop mutates after
      // the call (it pushes its own response + tool_result ack). Snapshot at call
      // time so we assert on what was actually sent, not the post-mutation state.
      let presenterMessagesSnapshot: Array<{ role: string; content: unknown }> = [];
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockImplementationOnce(
          async (args: { messages: Array<{ role: string; content: unknown }> }) => {
            presenterMessagesSnapshot = JSON.parse(JSON.stringify(args.messages));
            return PRESENTER_SHOW_FOOD_INPUT;
          }
        );

      await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(presenterMessagesSnapshot[presenterMessagesSnapshot.length - 1]).toEqual({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Worker findings are above. Render the appropriate view for the user now.',
          },
        ],
      });
    });
  });

  describe('worker loop cap', () => {
    it('throws after 10 iterations with "exceeded maximum iterations"', async () => {
      // Router says needs worker; worker always returns tool_use so loop never breaks.
      mockMessagesCreate.mockResolvedValueOnce(ROUTER_NEEDS_WORKER);
      mockMessagesCreate.mockResolvedValue(WORKER_LOOPS_GET_USER_LOG);

      await expect(runAgentLoop(USER_MESSAGES, 'user-1')).rejects.toThrow(
        'Worker loop exceeded maximum iterations'
      );
    });

    it('makes 11 total SDK calls when loop cap triggers (1 router + 10 worker)', async () => {
      mockMessagesCreate.mockResolvedValueOnce(ROUTER_NEEDS_WORKER);
      mockMessagesCreate.mockResolvedValue(WORKER_LOOPS_GET_USER_LOG);

      await expect(runAgentLoop(USER_MESSAGES, 'user-1')).rejects.toThrow();

      expect(mockMessagesCreate).toHaveBeenCalledTimes(11);
    });
  });

  describe('MCP execution — stub DB tools', () => {
    it('includes stub tool_result in messages passed to subsequent worker call', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_LOOPS_GET_USER_LOG) // worker call 1: calls get_user_log
        .mockResolvedValueOnce(WORKER_END_TURN) // worker call 2: finishes
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      // calls[2] is the second worker call — check its messages contain the stub tool_result.
      const secondWorkerArgs = mockMessagesCreate.mock.calls[2][0];
      const messages = secondWorkerArgs.messages as Array<{ role: string; content: unknown }>;
      const toolResultMsg = messages.find((m) => m.role === 'user' && Array.isArray(m.content));
      expect(toolResultMsg).toBeDefined();
      const content = toolResultMsg!.content as Array<{ content?: string }>;
      expect(content[0].content).toContain('stub');
    });
  });

  describe('MCP execution — USDA', () => {
    it('calls fetch with USDA API URL when API key is set', async () => {
      process.env.USDA_API_KEY = 'test-key';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          foods: [
            {
              description: 'Chicken Breast',
              foodNutrients: [
                { nutrientName: 'Energy', value: 165 },
                { nutrientName: 'Protein', value: 31 },
                { nutrientName: 'Total lipid (fat)', value: 3.6 },
                { nutrientName: 'Carbohydrate, by difference', value: 0 },
              ],
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_CALLS_USDA)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      expect(mockFetch).toHaveBeenCalledOnce();
      const url: string = mockFetch.mock.calls[0][0];
      expect(url).toContain('api.nal.usda.gov');
      expect(url).toContain('chicken%20breast');
      expect(url).toContain('test-key');
    });

    it('returns USDA_API_KEY-not-set note in tool_result when key is absent', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_CALLS_USDA)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      const secondWorkerArgs = mockMessagesCreate.mock.calls[2][0];
      const messages = secondWorkerArgs.messages as Array<{ role: string; content: unknown }>;
      const toolResultMsg = messages.find((m) => m.role === 'user' && Array.isArray(m.content));
      const content = toolResultMsg!.content as Array<{ content?: string }>;
      expect(content[0].content).toContain('USDA_API_KEY not set');
    });

    it('sanitizes non-ASCII characters from USDA food names', async () => {
      process.env.USDA_API_KEY = 'test-key';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          foods: [
            {
              description: 'Chicken ™ Breast®',
              foodNutrients: [{ nutrientName: 'Energy', value: 165 }],
            },
          ],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_NEEDS_WORKER)
        .mockResolvedValueOnce(WORKER_CALLS_USDA)
        .mockResolvedValueOnce(WORKER_END_TURN)
        .mockResolvedValueOnce(PRESENTER_SHOW_FOOD_INPUT);

      await runAgentLoop(USER_MESSAGES, 'user-1');

      const secondWorkerArgs = mockMessagesCreate.mock.calls[2][0];
      const messages = secondWorkerArgs.messages as Array<{ role: string; content: unknown }>;
      const toolResultMsg = messages.find((m) => m.role === 'user' && Array.isArray(m.content));
      const raw = toolResultMsg!.content as Array<{ content?: string }>;
      const parsed = JSON.parse(raw[0].content!);
      // Non-ASCII stripped: ™ and ® should not appear
      expect(parsed.items[0].name).not.toMatch(/[^\x20-\x7E]/);
    });
  });

  describe('presenter errors', () => {
    it('throws when presenter returns no tool_use blocks', async () => {
      mockMessagesCreate
        .mockResolvedValueOnce(ROUTER_SKIP_WORKER)
        .mockResolvedValueOnce(PRESENTER_NO_TOOL_CALLS);

      await expect(runAgentLoop(USER_MESSAGES, 'user-1')).rejects.toThrow(
        'Presenter returned no tool calls'
      );
    });
  });
});
