import { useEffect, useMemo, useRef, useState } from "react";
import { STARTER_MESSAGE } from "../constants";
import { Message, SourceAccordionState } from "../types";
import MessageBubble from "./MessageBubble";

type MessageListProps = {
  messages: Message[];
  typingMessageKey: string | null;
  typingText: string;
  hasGuestResponses: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
};

function splitGuestTeaser(content: string): { lead: string; tail: string } {
  const maxPreview = 240;
  if (content.length <= maxPreview) return { lead: content, tail: "" };
  const breakAt = content.lastIndexOf(" ", maxPreview);
  const splitAt = breakAt > 120 ? breakAt : maxPreview;
  return {
    lead: content.slice(0, splitAt),
    tail: content.slice(splitAt)
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export default function MessageList({
  messages,
  typingMessageKey,
  typingText,
  hasGuestResponses,
  onSignUp,
  onSignIn
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [sourceState, setSourceState] = useState<SourceAccordionState>({});
  const reducedMotion = usePrefersReducedMotion();

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        const isTyping = typingMessageKey === message.id;
        const animatedText = isTyping ? typingText : message.content;
        const shouldGate =
          hasGuestResponses &&
          message.role === "assistant" &&
          message.content !== STARTER_MESSAGE;
        const teaser = shouldGate ? splitGuestTeaser(animatedText) : null;
        return { message, isTyping, animatedText, shouldGate, teaser };
      }),
    [messages, typingMessageKey, typingText, hasGuestResponses]
  );

  useEffect(() => {
    const nextState: SourceAccordionState = {};
    for (const message of messages) {
      if (message.sources?.length) {
        nextState[message.id] = sourceState[message.id] ?? false;
      }
    }
    setSourceState(nextState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 96;
    if (isNearBottom) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion ? "auto" : "smooth"
      });
    }
  }, [messages, typingText, reducedMotion]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpToLatest(distanceFromBottom > 180);
  }

  function jumpToLatest() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }

  return (
    <section className="message-panel">
      <div className="message-list" ref={scrollRef} onScroll={onScroll}>
        {renderedMessages.map(({ message, isTyping, animatedText, shouldGate, teaser }) => (
          <MessageBubble
            key={message.id}
            message={message}
            isTyping={isTyping}
            animatedText={animatedText}
            shouldGate={shouldGate}
            teaser={teaser}
            sourcesExpanded={sourceState[message.id] ?? false}
            onToggleSources={() =>
              setSourceState((current) => ({ ...current, [message.id]: !current[message.id] }))
            }
            onSignUp={onSignUp}
            onSignIn={onSignIn}
          />
        ))}
      </div>
      {showJumpToLatest ? (
        <button type="button" className="jump-latest" onClick={jumpToLatest}>
          Jump to latest
        </button>
      ) : null}
    </section>
  );
}
