import { ChatTheme } from "../types";
import { KeyboardEvent } from "react";

type ChatHeaderProps = {
  displayName: string;
  isGuest: boolean;
  theme: ChatTheme;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
};

export default function ChatHeader({
  displayName,
  isGuest,
  theme,
  sidebarOpen,
  onToggleSidebar,
  onToggleTheme,
  onGoHome,
  onOpenLogin,
  onOpenSignup
}: ChatHeaderProps) {
  function onBrandKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onGoHome();
    }
  }

  return (
    <header className="chat-header">
      <div className="chat-brand" onClick={onGoHome} onKeyDown={onBrandKeyDown} role="button" tabIndex={0}>
        <span className="logo-dot" />
        <div>
          <strong>FarmersMark</strong>
          <small>{isGuest ? "Guest Session" : `Logged in as ${displayName}`}</small>
        </div>
      </div>

      <div className="chat-header-actions">
        <button
          type="button"
          className="ghost"
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        </button>
        <button type="button" className="ghost" onClick={onToggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        {isGuest ? (
          <>
            <button type="button" className="ghost" onClick={onOpenLogin}>
              Sign In
            </button>
            <button type="button" className="cta" onClick={onOpenSignup}>
              Create Account
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
