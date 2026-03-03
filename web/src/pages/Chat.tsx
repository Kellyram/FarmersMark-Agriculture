import React, { useState, useRef, useEffect } from "react";
import { httpsCallable, connectFunctionsEmulator } from "firebase/functions";
import { functions } from "../firebase.config";
import { useAuth } from "../contexts/AuthContext";
import {
  Send,
  Leaf,
  Bot,
  UserCircle2,
  AlertTriangle,
  Sprout,
} from "lucide-react";

// ============================================================================
// 🔌 THE FIX: Force the frontend to talk to your Local Python Brain
// ============================================================================
try {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.log("✅ Successfully wired to local Python Emulator on port 5001");
} catch (e) {
  // We ignore errors here because React hot-reloading might run this twice!
}

const analyzeDocument = httpsCallable<
  { question: string },
  { answer?: string; error?: string }
>(functions, "analyzeDocument");
// ============================================================================

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  timestamp: Date;
}

const TypingIndicator: React.FC = () => (
  <div className="flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
      <Bot className="w-5 h-5 text-primary" />
    </div>
    <div className="bg-white border border-gray-100 rounded-3xl rounded-bl-md px-5 py-4 shadow-sm">
      <div className="flex gap-1.5 items-center h-5">
        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  </div>
);

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  if (isUser) {
    return (
      <div className="flex items-end gap-3 flex-row-reverse animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-primary flex items-center justify-center text-white">
          <UserCircle2 className="w-5 h-5" />
        </div>
        <div className="max-w-[75%] bg-primary text-white rounded-3xl rounded-br-md px-5 py-3.5 shadow-md">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-danger" />
        </div>
        <div className="max-w-[75%] bg-red-50 border border-red-200 rounded-3xl rounded-bl-md px-5 py-3.5">
          <p className="text-sm font-bold text-danger leading-relaxed">
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Bot className="w-5 h-5 text-primary" />
      </div>
      <div className="max-w-[75%] bg-white border border-gray-100 rounded-3xl rounded-bl-md px-5 py-3.5 shadow-sm">
        <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
          {message.text}
        </p>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ userName: string | null }> = ({ userName }) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-4 select-none">
    <div className="relative mb-6">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20">
        <Leaf className="w-10 h-10 text-primary" />
      </div>
      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
        <Sprout className="w-4 h-4 text-primary/60" />
      </div>
    </div>
    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
      Hello, {userName ?? "Farmer"} 👋
    </h2>
    <p className="text-muted font-medium mt-2 max-w-sm text-sm">
      Ask me anything about your crops, soils, market prices, or farm
      management. I'll analyse your documents to find answers.
    </p>
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
      {[
        "What diseases are common in maize this season?",
        "Summarise the crop yield report",
        "What is the current market price for wheat?",
        "Best practices for soil moisture management",
      ].map((suggestion) => (
        <button
          key={suggestion}
          className="text-left px-4 py-3 rounded-2xl border border-gray-200 bg-white/60 hover:bg-white hover:border-primary/30 hover:shadow-sm text-sm font-medium text-gray-700 transition-all duration-150"
          onClick={() => {
            const event = new CustomEvent("chat-suggestion", {
              detail: suggestion,
            });
            window.dispatchEvent(event);
          }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  </div>
);

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayName = user?.displayName ?? user?.email?.split("@")[0] ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handler = (e: Event) => {
      const suggestion = (e as CustomEvent<string>).detail;
      setInput(suggestion);
      textareaRef.current?.focus();
    };
    window.addEventListener("chat-suggestion", handler);
    return () => window.removeEventListener("chat-suggestion", handler);
  }, []);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const result = await analyzeDocument({ question });
      const data = result.data;

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "error",
            text: `Cloud Function Error: ${data.error}`,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: data.answer ?? "No answer was returned.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error",
          text:
            err?.message ?? "An unexpected error occurred. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gradient-to-b from-accent-cream to-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 bg-white/70 backdrop-blur-md border-b border-gray-100">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-black text-gray-900 tracking-tight">
            AgroMind AI
          </h1>
          <p className="text-xs font-bold text-muted">
            Powered by your farm documents
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Connected to Emulator
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="max-w-3xl mx-auto w-full">
          {messages.length === 0 ? (
            <EmptyState userName={displayName} />
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && <TypingIndicator />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-3xl mx-auto w-full">
          <div className="flex items-end gap-3 bg-white border border-gray-200 rounded-3xl shadow-lg px-4 py-3 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
            <textarea
              ref={textareaRef}
              id="chat-input"
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your crops, documents, or farm data..."
              rows={1}
              className="flex-1 resize-none bg-transparent outline-none text-gray-800 placeholder:text-gray-400 text-sm leading-relaxed max-h-40 py-1"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              id="chat-send-button"
              className="flex-shrink-0 w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center transition-all duration-200 hover:bg-primary-strong disabled:opacity-40 disabled:pointer-events-none active:scale-90 shadow-md"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <Send className="w-4 h-4 translate-x-0.5" />
              )}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2 font-medium">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md font-mono text-[10px]">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md font-mono text-[10px]">
              Shift+Enter
            </kbd>{" "}
            for new line
          </p>
        </div>
      </div>
    </div>
  );
};
