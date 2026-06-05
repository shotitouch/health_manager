import { useState } from 'react';

interface AskClarificationInput {
  question: string;
  options?: string[];
}

interface Props {
  input: AskClarificationInput;
  onResult?: (data: unknown) => void;
}

export default function AskClarification({ input, onResult }: Props) {
  const [freeText, setFreeText] = useState('');

  function handleOption(option: string) {
    onResult?.({ answer: option });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (freeText.trim()) {
      onResult?.({ answer: freeText.trim() });
      setFreeText('');
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-medium text-foreground">{input.question}</p>

      {input.options && input.options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {input.options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleOption(option)}
              className="rounded-full border border-border bg-background px-3 py-1 text-sm hover:bg-accent transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Type your answer…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!freeText.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
