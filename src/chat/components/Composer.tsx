import { FormEvent, KeyboardEvent, useEffect, useRef } from "react";

type ComposerProps = {
  value: string;
  loading: boolean;
  canRetry: boolean;
  onChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onStop: () => void;
  onRetry: () => void;
};

export default function Composer({
  value,
  loading,
  canRetry,
  onChange,
  onSubmit,
  onStop,
  onRetry
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${Math.max(nextHeight, 92)}px`;
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form className="chat-composer" ref={formRef} onSubmit={onSubmit}>
      <label htmlFor="chat-composer-input" className="sr-only">
        Ask a question
      </label>
      <textarea
        id="chat-composer-input"
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about inputs, pest outbreaks, market trends, or policy updates..."
        rows={3}
      />
      <div className="composer-actions">
        {canRetry && !loading ? (
          <button type="button" className="ghost" onClick={onRetry}>
            Retry
          </button>
        ) : null}
        {loading ? (
          <button type="button" className="ghost" onClick={onStop}>
            Stop
          </button>
        ) : null}
        <button type="submit" className="cta" disabled={loading || !value.trim()}>
          Send
        </button>
      </div>
    </form>
  );
}
