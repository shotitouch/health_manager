import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { anthropic, PRESENTER_MODEL, MAX_TOKENS, mapContentBlock } from './agent-runtime.js';
import { PRESENTER_PROMPT_BLOCK } from './prompts.js';
import { FE_TOOLS } from './tool-registry.js';
import { routingContextTurn, type RouterResult } from './intent-router.js';

export async function runPresenterLoop(
  messages: MessageParam[],
  route: RouterResult,
  userId: string
): Promise<{ feToolCalls: ToolUseBlock[]; messages: MessageParam[] }> {
  const currentMessages: MessageParam[] = [...messages, routingContextTurn(route)];

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
