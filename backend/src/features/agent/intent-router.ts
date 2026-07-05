import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { anthropic, ROUTER_MODEL } from './agent-runtime.js';
import { ROUTER_PROMPT_BLOCK } from './prompts.js';

// ---------------------------------------------------------------------------
// Router tier — forced single tool call on cheap Haiku model. Classifies the
// request into a distilled intent + domains that steer the Worker/Presenter.
// ---------------------------------------------------------------------------

// Single source of truth for the routing domains — shared by the tool schema
// and the Zod validator so the two can't drift.
const DOMAINS = ['food', 'exercise', 'data', 'navigation', 'general'] as const;

const CLASSIFY_INTENT_TOOL: Anthropic.Tool = {
  name: 'classify_intent',
  description: 'Classify the user request for routing to the Worker and Presenter tiers.',
  input_schema: {
    type: 'object',
    properties: {
      intent_summary: {
        type: 'string',
        description:
          'A compact, normalized restatement of what the user wants — one or two sentences. Resolve pronouns, informal portions, and compound asks. e.g. "Log a ~200g fried-chicken lunch and show today\'s remaining calories".',
      },
      domains: {
        type: 'array',
        items: {
          type: 'string',
          enum: [...DOMAINS],
        },
        minItems: 1,
        description:
          'All domains the request touches (multi-label for compound requests). food = log/identify food; exercise = log/identify exercise; data = fetch existing logs/profile/totals; navigation = just show a screen, no data; general = open health Q&A.',
      },
      has_image: { type: 'boolean', description: 'True if the user message contains an image.' },
    },
    required: ['intent_summary', 'domains', 'has_image'],
    additionalProperties: false,
  },
};

// Validates the snake_case tool input, then maps to a camelCase RouterResult.
const RouterResultSchema = z
  .object({
    intent_summary: z.string(),
    domains: z.array(z.enum(DOMAINS)).min(1),
    has_image: z.boolean(),
  })
  .transform((r) => ({
    intentSummary: r.intent_summary,
    domains: r.domains,
    hasImage: r.has_image,
  }));
export type RouterResult = z.infer<typeof RouterResultSchema>;

// Fallback when the Router output is missing or malformed: treat as a general
// question so the Worker still runs (only pure navigation skips it).
const ROUTER_FALLBACK: RouterResult = { intentSummary: '', domains: ['general'], hasImage: false };

export async function runRouter(messages: MessageParam[], userId: string): Promise<RouterResult> {
  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 256,
    system: [ROUTER_PROMPT_BLOCK],
    messages,
    tools: [CLASSIFY_INTENT_TOOL],
    tool_choice: { type: 'tool', name: 'classify_intent', disable_parallel_tool_use: true },
    metadata: { user_id: userId },
  });

  const block = response.content.find((b): b is ToolUseBlock => b.type === 'tool_use');
  if (!block) return ROUTER_FALLBACK;

  const parsed = RouterResultSchema.safeParse(block.input);
  if (!parsed.success) return ROUTER_FALLBACK;
  return parsed.data;
}

// Injects the Router's distilled intent into a tier as a trailing user turn.
// Kept in the message stream (NOT the cached system prompt) so this per-request
// data never invalidates the 5-min system-prompt cache.
export function routingContextTurn(route: RouterResult): MessageParam {
  // intent_summary is LLM-paraphrased from user input — strip angle brackets and
  // clamp length so it can't forge a </routing_context> close or smuggle markup.
  const summary = route.intentSummary.replace(/[<>]/g, ' ').slice(0, 300).trim();
  const lines = [
    `User intent: ${summary || '(none extracted)'}`,
    `Domains involved: ${route.domains.join(', ')}`,
  ];
  if (route.hasImage) {
    lines.push('The user message includes an image — identify the food/exercise from it first.');
  }
  return {
    role: 'user',
    content: [{ type: 'text', text: `<routing_context>\n${lines.join('\n')}\n</routing_context>` }],
  };
}
