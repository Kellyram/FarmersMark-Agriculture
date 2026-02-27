import { FormEvent, useEffect, useState } from "react";
import { Message, Conversation, ChatTheme } from "../types";
import ChatHeader from "./ChatHeader";
import ChatSidebar from "./ChatSidebar";
import Composer from "./Composer";
import MessageList from "./MessageList";

type ChatWorkspaceProps = {
  displayName: string;
  isGuest: boolean;
  conversations: Conversation[];
  activeChatId: string | null;
  messages: Message[];
  input: string;
  loading: boolean;
  canRetry: boolean;
  hasGuestResponses: boolean;
  typingMessageKey: string | null;
  typingText: string;
  theme: ChatTheme;
  sidebarOpen: boolean;
  onSidebarOpenChange: (next: boolean) => void;
  onToggleTheme: () => void;
  onInputChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onRetry: () => void;
  onStop: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onLogout: () => Promise<void> | void;
  onGoHome: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
};

function useIsMobileBreakpoint() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1024px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export default function ChatWorkspace({
  displayName,
  isGuest,
  conversations,
  activeChatId,
  messages,
  input,
  loading,
  canRetry,
  hasGuestResponses,
  typingMessageKey,
  typingText,
  theme,
  sidebarOpen,
  onSidebarOpenChange,
  onToggleTheme,
  onInputChange,
  onSubmit,
  onRetry,
  onStop,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onLogout,
  onGoHome,
  onOpenLogin,
  onOpenSignup
}: ChatWorkspaceProps) {
  const isMobile = useIsMobileBreakpoint();

  function withMobileClose(action: () => void) {
    action();
    if (isMobile) {
      onSidebarOpenChange(false);
    }
  }

  return (
    <main className={`chat-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <ChatHeader
        displayName={displayName}
        isGuest={isGuest}
        theme={theme}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => onSidebarOpenChange(!sidebarOpen)}
        onToggleTheme={onToggleTheme}
        onGoHome={onGoHome}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
      />

      <div className="chat-body">
        <ChatSidebar
          isGuest={isGuest}
          displayName={displayName}
          conversations={conversations}
          activeChatId={activeChatId}
          sidebarOpen={sidebarOpen}
          onSelectChat={(chatId) => withMobileClose(() => onSelectChat(chatId))}
          onDeleteChat={onDeleteChat}
          onNewChat={() => withMobileClose(onNewChat)}
          onOpenLogin={onOpenLogin}
          onLogout={onLogout}
          onCloseSidebar={() => onSidebarOpenChange(false)}
        />

        {isMobile && sidebarOpen ? (
          <button
            type="button"
            className="chat-overlay"
            aria-label="Close sidebar"
            onClick={() => onSidebarOpenChange(false)}
          />
        ) : null}

        <section className="chat-main">
          <MessageList
            messages={messages}
            typingMessageKey={typingMessageKey}
            typingText={typingText}
            hasGuestResponses={hasGuestResponses}
            loading={loading}
            onSignUp={onOpenSignup}
            onSignIn={onOpenLogin}
          />
          <Composer
            value={input}
            loading={loading}
            canRetry={canRetry}
            onChange={onInputChange}
            onSubmit={onSubmit}
            onRetry={onRetry}
            onStop={onStop}
          />
        </section>
      </div>
    </main>
  );
}
