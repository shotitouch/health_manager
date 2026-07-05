import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages/messages.js';
import { runRouter } from './intent-router.js';
import { runWorkerLoop } from './worker-loop.js';
import { runPresenterLoop } from './presenter-loop.js';

export interface AgentResult {
  messages: MessageParam[];
  feToolCalls: ToolUseBlock[];
}

export async function runAgentLoop(messages: MessageParam[], userId: string): Promise<AgentResult> {
  const route = await runRouter(messages, userId);
  const skipWorker = route.domains.length === 1 && route.domains[0] === 'navigation';
  const workerMessages = skipWorker ? null : await runWorkerLoop(messages, route, userId);
  const messagesForPresenter = workerMessages
    ? [...messages, workerMessages.at(-2)!, workerMessages.at(-1)!]
    : messages;
  const { feToolCalls, messages: finalMessages } = await runPresenterLoop(
    messagesForPresenter,
    route,
    userId
  );
  return { messages: finalMessages, feToolCalls };
}
