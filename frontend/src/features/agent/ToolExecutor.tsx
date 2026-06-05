import type { ComponentType } from 'react';
import AskClarification from './AskClarification.js';

interface ToolProps {
  input: Record<string, unknown>;
  onResult?: (data: unknown) => void;
}

// Static map — never add entries at runtime or from external input.
const TOOL_MAP: Record<string, ComponentType<ToolProps>> = {
  ask_clarification: AskClarification,
};

interface Props {
  toolName: string;
  input: Record<string, unknown>;
  onResult?: (data: unknown) => void;
}

export default function ToolExecutor({ toolName, input, onResult }: Props) {
  const Component = TOOL_MAP[toolName];

  if (!Component) {
    console.warn(`ToolExecutor: unknown tool "${toolName}" — skipping render`);
    return null;
  }

  return <Component input={input} onResult={onResult} />;
}
