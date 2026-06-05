import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type {
  MessageParam,
  ToolUseBlock,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages/messages.js';
import { FE_TOOLS, MCP_TOOLS } from './tool-registry.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// claude-haiku-4-5-20251001 is Haiku's canonical model ID — Anthropic requires the date suffix for this model.
const ROUTER_MODEL = 'claude-haiku-4-5-20251001';
const WORKER_MODEL = 'claude-sonnet-4-6';
const PRESENTER_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const MAX_LOOP_ITERATIONS = 10;

// ---------------------------------------------------------------------------
// System prompts — one concern each, cache-controlled (5-min TTL).
// ---------------------------------------------------------------------------

const ROUTER_PROMPT_BLOCK: TextBlockParam = {
  type: 'text',
  text: `Classify the user's health tracking request by calling classify_intent.
Intents: navigate (show a screen with no data needed), log_food, log_exercise, query_data (fetch existing logs/profile), conversation (general health Q&A).
Set skipWorker true only for pure navigation — e.g. "show dashboard", "open food log". All other intents need the Worker to fetch or identify data first.`,
  cache_control: { type: 'ephemeral' },
};

const WORKER_PROMPT_BLOCK: TextBlockParam = {
  type: 'text',
  text: `You are a health data worker. Use tools to fetch and process data for the user's request. Do not call any UI tools.
For food identification: search the user's food library first, then USDA, then Thai database, then web search as last resort.
For informal portions (e.g. "2 thumb"): convert to standard weight (1 thumb ≈ 30g for solid food) before searching.
For ingredient-based foods not in any database: decompose into known ingredients and search each one separately, then sum.
Stop when you have enough data — do not over-fetch.`,
  cache_control: { type: 'ephemeral' },
};

const PRESENTER_PROMPT_BLOCK: TextBlockParam = {
  type: 'text',
  text: `You are a UI presenter for a health tracking app. Based on the conversation and any data already gathered, call exactly one frontend tool.
- Food/exercise identified → show_food_input or show_exercise_input with prefill populated.
- User query answered → display_message.
- Input too ambiguous to act on → ask_clarification with a specific question.
- Navigation request → show_* screen directly.`,
  cache_control: { type: 'ephemeral' },
};

// ---------------------------------------------------------------------------
// Router — forced single tool call on cheap Haiku model.
// ---------------------------------------------------------------------------

const CLASSIFY_INTENT_TOOL: Anthropic.Tool = {
  name: 'classify_intent',
  description: 'Classify the user intent for routing to the correct agent.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['navigate', 'log_food', 'log_exercise', 'query_data', 'conversation'],
      },
      hasImage: { type: 'boolean', description: 'True if the user message contains an image.' },
      skipWorker: {
        type: 'boolean',
        description:
          'True only for pure navigation with no data fetching needed. False for everything else.',
      },
    },
    required: ['intent', 'hasImage', 'skipWorker'],
    additionalProperties: false,
  },
};

const RouterResultSchema = z.object({
  intent: z.enum(['navigate', 'log_food', 'log_exercise', 'query_data', 'conversation']),
  hasImage: z.boolean(),
  skipWorker: z.boolean(),
});
type RouterResult = z.infer<typeof RouterResultSchema>;

async function runRouter(messages: MessageParam[], userId: string): Promise<RouterResult> {
  const response = await anthropic.messages.create({
    model: ROUTER_MODEL,
    max_tokens: 256,
    system: [ROUTER_PROMPT_BLOCK],
    messages,
    tools: [CLASSIFY_INTENT_TOOL],
    tool_choice: { type: 'tool', name: 'classify_intent' },
    metadata: { user_id: userId },
  });

  const block = response.content.find((b): b is ToolUseBlock => b.type === 'tool_use');
  if (!block) return { intent: 'conversation', hasImage: false, skipWorker: false };

  const parsed = RouterResultSchema.safeParse(block.input);
  if (!parsed.success) return { intent: 'conversation', hasImage: false, skipWorker: false };
  return parsed.data;
}

// ---------------------------------------------------------------------------
// MCP tool input schemas — LLM output is external data; validate before use.
// ---------------------------------------------------------------------------

const McpInputSchemas: Record<string, z.ZodTypeAny> = {
  search_food_library: z.object({ query: z.string().min(1) }),
  search_nutrition_usda: z.object({ query: z.string().min(1) }),
  search_nutrition_thai: z.object({ query: z.string().min(1) }),
  web_search: z.object({ query: z.string().min(1) }),
  get_user_log: z.object({
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  get_user_profile: z.object({}),
  save_food_entry: z.object({
    name: z.string().min(1),
    calories: z.number().nonnegative(),
    protein_g: z.number().nonnegative().optional(),
    fat_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    weight_g: z.number().nonnegative().optional(),
    logged_at: z.string().optional(),
  }),
  save_exercise_entry: z.object({
    name: z.string().min(1),
    calories_burned: z.number().nonnegative(),
    duration_min: z.number().nonnegative().optional(),
    logged_at: z.string().optional(),
  }),
  save_to_food_library: z.object({
    name: z.string().min(1),
    default_calories: z.number().nonnegative(),
    default_protein_g: z.number().nonnegative().optional(),
    default_fat_g: z.number().nonnegative().optional(),
    default_carbs_g: z.number().nonnegative().optional(),
    default_weight_g: z.number().nonnegative().optional(),
    source: z.string().optional(),
  }),
  save_to_exercise_library: z.object({
    name: z.string().min(1),
    default_calories_per_min: z.number().nonnegative().optional(),
    met_value: z.number().nonnegative().optional(),
    source: z.string().optional(),
  }),
  search_exercise_library: z.object({ query: z.string().min(1) }),
};

// ---------------------------------------------------------------------------
// MCP tool execution.
// ---------------------------------------------------------------------------

async function executeMcpTool(block: ToolUseBlock, _userId: string): Promise<unknown> {
  const schema = McpInputSchemas[block.name];
  if (!schema) {
    throw Object.assign(new Error(`Unknown MCP tool: ${block.name}`), { status: 500 });
  }

  const parsed = schema.safeParse(block.input);
  if (!parsed.success) {
    throw Object.assign(
      new Error(
        `Invalid input for ${block.name}: ${parsed.error.issues.map((i) => i.message).join('; ')}`
      ),
      { status: 400 }
    );
  }
  const input = parsed.data as Record<string, unknown>;

  switch (block.name) {
    case 'search_nutrition_usda': {
      const apiKey = process.env.USDA_API_KEY;
      if (!apiKey) return { items: [], note: 'USDA_API_KEY not set in environment' };
      const query = encodeURIComponent(input.query as string);
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${query}&pageSize=3&api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return { items: [], error: `USDA API returned ${res.status}` };
      const data = (await res.json()) as {
        foods?: Array<{
          description: string;
          foodNutrients: Array<{ nutrientName: string; value: number }>;
        }>;
      };
      if (!data.foods?.length) return { items: [] };
      const pick = (nutrients: Array<{ nutrientName: string; value: number }>, name: string) =>
        nutrients.find((n) => n.nutrientName === name)?.value ?? null;
      return {
        note: 'Values are per 100g. Scale to the actual portion weight yourself.',
        items: data.foods.slice(0, 3).map((f) => ({
          // Sanitize: strip non-printable-ASCII and clamp length to prevent prompt injection from USDA data.
          name: f.description.replace(/[^\x20-\x7E]/g, '').slice(0, 200),
          per_100g: {
            calories: pick(f.foodNutrients, 'Energy'),
            protein_g: pick(f.foodNutrients, 'Protein'),
            fat_g: pick(f.foodNutrients, 'Total lipid (fat)'),
            carbs_g: pick(f.foodNutrients, 'Carbohydrate, by difference'),
          },
        })),
      };
    }

    case 'search_nutrition_thai':
      // TODO: integrate Mahidol INMU Thai Food Composition DB or Open Food Facts Thai subset.
      return { items: [], note: 'Thai nutrition database not yet integrated' };

    case 'web_search':
      // TODO: integrate Brave Search API or Serper. Set WEB_SEARCH_API_KEY in .env.
      return { results: [], note: 'Web search not yet integrated' };

    // DB stubs — implement once PostgreSQL layer exists.
    default:
      return { stub: true, note: `${block.name}: DB not yet implemented` };
  }
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

// Maps SDK response ContentBlock to the ContentBlockParam shape needed for MessageParam.
// ContentBlock (output) and ContentBlockParam (input) are structurally similar but different SDK types.
function mapContentBlock(
  block: Anthropic.Messages.ContentBlock
): Anthropic.Messages.ContentBlockParam {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'tool_use')
    return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
  return block as unknown as Anthropic.Messages.ContentBlockParam;
}

// ---------------------------------------------------------------------------
// Worker loop — MCP tools only, no FE tools.
// ---------------------------------------------------------------------------

async function runWorkerLoop(messages: MessageParam[], userId: string): Promise<MessageParam[]> {
  const currentMessages: MessageParam[] = [...messages];
  let iterations = 0;

  while (true) {
    if (iterations >= MAX_LOOP_ITERATIONS) {
      throw Object.assign(new Error('Worker loop exceeded maximum iterations'), { status: 500 });
    }
    iterations++;

    const response = await anthropic.messages.create({
      model: WORKER_MODEL,
      max_tokens: MAX_TOKENS,
      system: [WORKER_PROMPT_BLOCK],
      messages: currentMessages,
      tools: [...MCP_TOOLS],
      metadata: { user_id: userId },
    });

    currentMessages.push({ role: 'assistant', content: response.content.map(mapContentBlock) });

    if (response.stop_reason !== 'tool_use') break;

    const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeMcpTool(block, userId);
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        } catch (err) {
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify({
              error: err instanceof Error ? err.message : 'Tool execution failed',
            }),
            is_error: true,
          };
        }
      })
    );

    currentMessages.push({ role: 'user', content: toolResults });
  }

  return currentMessages;
}

// ---------------------------------------------------------------------------
// Presenter loop — FE tools only, forced to always call a tool.
// ---------------------------------------------------------------------------

async function runPresenterLoop(
  messages: MessageParam[],
  userId: string
): Promise<{ feToolCalls: ToolUseBlock[]; messages: MessageParam[] }> {
  const currentMessages: MessageParam[] = [...messages];

  const response = await anthropic.messages.create({
    model: PRESENTER_MODEL,
    max_tokens: MAX_TOKENS,
    system: [PRESENTER_PROMPT_BLOCK],
    messages: currentMessages,
    tools: [...FE_TOOLS],
    tool_choice: { type: 'any' },
    metadata: { user_id: userId },
  });

  currentMessages.push({ role: 'assistant', content: response.content.map(mapContentBlock) });

  const feToolCalls = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

  if (feToolCalls.length === 0) {
    throw Object.assign(new Error('Presenter returned no tool calls'), { status: 500 });
  }

  // Append tool_result acknowledgements so the returned history is valid for future Anthropic API calls.
  currentMessages.push({
    role: 'user',
    content: feToolCalls.map((block) => ({
      type: 'tool_result' as const,
      tool_use_id: block.id,
      content: JSON.stringify({ rendered: true }),
    })),
  });

  return { feToolCalls, messages: currentMessages };
}

// ---------------------------------------------------------------------------
// Public API — orchestrates Router → Worker → Presenter.
// ---------------------------------------------------------------------------

export interface AgentResult {
  messages: MessageParam[];
  feToolCalls: ToolUseBlock[];
}

export async function runAgentLoop(messages: MessageParam[], userId: string): Promise<AgentResult> {
  const route = await runRouter(messages, userId);
  const messagesForPresenter = route.skipWorker ? messages : await runWorkerLoop(messages, userId);
  const { feToolCalls, messages: finalMessages } = await runPresenterLoop(
    messagesForPresenter,
    userId
  );
  return { messages: finalMessages, feToolCalls };
}
