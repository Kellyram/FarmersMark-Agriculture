import { FormEvent, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: string[];
};

type ChatResponse = {
  answer: string;
  sources: string[];
};

const starter = "Ask anything about the attached Vertex AI RAG notes.";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: crypto.randomUUID(), role: "assistant", content: starter }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const transcript = useMemo(() => messages.filter((m) => m.role !== "assistant" || m.content !== starter), [messages]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: trimmed,
          history: transcript.map((m) => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          sources: data.sources
        }
      ]);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `I could not process that request. ${text}`
        }
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function onStop() {
    abortRef.current?.abort();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">RAG Assistant</div>
        <p className="meta">Knowledge: Copy of Vertex AI RAG Notes.docx.pdf</p>
      </aside>

      <main className="chat">
        <section className="messages">
          {messages.map((message) => (
            <article key={message.id} className={`bubble ${message.role}`}>
              <header>{message.role === "user" ? "You" : "Assistant"}</header>
              <p>{message.content}</p>
              {message.sources && message.sources.length > 0 && (
                <ul className="sources">
                  {message.sources.map((source, idx) => (
                    <li key={`${source}-${idx}`}>{source}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <form className="composer" onSubmit={onSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message your PDF assistant..."
            rows={2}
          />
          <div className="actions">
            {loading ? (
              <button type="button" onClick={onStop}>
                Stop
              </button>
            ) : null}
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
