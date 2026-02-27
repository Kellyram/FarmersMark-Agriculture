import GuestGateCard from "./GuestGateCard";
import MarkdownMessage from "./MarkdownMessage";
import SourceAccordion from "./SourceAccordion";
import { Message } from "../types";

type MessageBubbleProps = {
  message: Message;
  isTyping: boolean;
  animatedText: string;
  shouldGate: boolean;
  teaser: { lead: string; tail: string } | null;
  sourcesExpanded: boolean;
  onToggleSources: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
};

export default function MessageBubble({
  message,
  isTyping,
  animatedText,
  shouldGate,
  teaser,
  sourcesExpanded,
  onToggleSources,
  onSignUp,
  onSignIn
}: MessageBubbleProps) {
  const roleLabel = message.role === "user" ? "You" : "Assistant";
  const canShowSources = !shouldGate && !!message.sources && message.sources.length > 0;

  return (
    <article className={`chat-bubble ${message.role}`}>
      <header className="chat-bubble-header">
        <span className="bubble-role">{roleLabel}</span>
      </header>

      {isTyping ? (
        <p className="bubble-text">
          {animatedText}
          <span className="typing-caret" aria-hidden="true">
            |
          </span>
        </p>
      ) : teaser ? (
        <p className="bubble-text">
          <span>{teaser.lead}</span>
          {teaser.tail ? <span className="teaser-tail">{teaser.tail}</span> : null}
        </p>
      ) : message.role === "assistant" ? (
        <div className="bubble-markdown">
          <MarkdownMessage content={message.content} />
        </div>
      ) : (
        <p className="bubble-text">{message.content}</p>
      )}

      {shouldGate ? <GuestGateCard onSignUp={onSignUp} onSignIn={onSignIn} /> : null}
      {canShowSources ? (
        <SourceAccordion
          sources={message.sources!}
          expanded={sourcesExpanded}
          onToggle={onToggleSources}
        />
      ) : null}
    </article>
  );
}
