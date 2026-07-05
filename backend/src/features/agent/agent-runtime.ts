import Anthropic from '@anthropic-ai/sdk';

// Shared LLM-call infrastructure for the 3-tier pipeline — the Anthropic client,
// the model/token config, and the response→param block helper. Leaf module
// (imports only the SDK) so the tier files can depend on it without cycles.

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// claude-haiku-4-5-20251001 is Haiku's canonical model ID — Anthropic requires the date suffix for this model.
export const ROUTER_MODEL = 'claude-haiku-4-5-20251001';
export const WORKER_MODEL = 'claude-sonnet-4-6';
export const PRESENTER_MODEL = 'claude-sonnet-4-6';
export const MAX_TOKENS = 4096;
export const MAX_LOOP_ITERATIONS = 10;

// Maps SDK response ContentBlock to the ContentBlockParam shape needed for MessageParam.
// ContentBlock (output) and ContentBlockParam (input) are structurally similar but different SDK types.
export function mapContentBlock(
  block: Anthropic.Messages.ContentBlock
): Anthropic.Messages.ContentBlockParam {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'tool_use')
    return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
  return block as unknown as Anthropic.Messages.ContentBlockParam;
}
