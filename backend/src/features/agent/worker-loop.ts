import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import {
  anthropic,
  WORKER_MODEL,
  MAX_TOKENS,
  MAX_LOOP_ITERATIONS,
  mapContentBlock,
} from './agent-runtime.js';
import { WORKER_PROMPT_BLOCK, WORKER_TO_PRESENTER_HANDOFF } from './prompts.js';
import { MCP_TOOLS } from './tool-registry.js';
import { executeMcpTool } from './mcp-executor.js';
import { routingContextTurn, type RouterResult } from './intent-router.js';

export async function runWorkerLoop(
  messages: MessageParam[],
  route: RouterResult,
  userId: string
): Promise<MessageParam[]> {
  const currentMessages: MessageParam[] = [...messages, routingContextTurn(route)];
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

    if (response.stop_reason !== 'tool_use') {
      if (response.stop_reason !== 'end_turn') {
        throw Object.assign(
          new Error(`Worker did not complete cleanly (stop_reason: ${response.stop_reason})`),
          { status: 502 }
        );
      }
      break;
    }

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

  currentMessages.push(WORKER_TO_PRESENTER_HANDOFF);

  return currentMessages;
}
