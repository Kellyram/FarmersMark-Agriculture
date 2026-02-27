import { Conversation } from "../types";

type ChatSidebarProps = {
  isGuest: boolean;
  displayName: string;
  conversations: Conversation[];
  activeChatId: string | null;
  sidebarOpen: boolean;
  onSelectChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNewChat: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onCloseSidebar: () => void;
};

export default function ChatSidebar({
  isGuest,
  displayName,
  conversations,
  activeChatId,
  sidebarOpen,
  onSelectChat,
  onDeleteChat,
  onNewChat,
  onOpenLogin,
  onLogout,
  onCloseSidebar
}: ChatSidebarProps) {
  return (
    <aside className={`chat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="chat-sidebar-top">
        <h2>Session</h2>
        <button type="button" className="ghost close-sidebar" onClick={onCloseSidebar}>
          Close
        </button>
      </div>

      <p className="sidebar-session-copy">
        {isGuest ? (
          <>
            Guest mode <strong>(not saved)</strong>
          </>
        ) : (
          <>
            Logged in as <strong>{displayName}</strong>
          </>
        )}
      </p>

      <button type="button" className="ghost side-button" onClick={onNewChat}>
        + New Chat
      </button>

      {isGuest ? (
        <div className="history-block">
          <h3>History</h3>
          <p className="muted">Guest chats are not saved. Sign in to keep your history.</p>
          <button type="button" className="cta side-button" onClick={onOpenLogin}>
            Sign In
          </button>
        </div>
      ) : (
        <>
          <div className="history-block">
            <h3>History</h3>
            {conversations.length === 0 ? <p className="muted">No saved chats yet.</p> : null}
            {conversations.map((chat) => (
              <div key={chat.id} className={`history-row ${chat.id === activeChatId ? "active" : ""}`}>
                <button type="button" className="history-open" onClick={() => onSelectChat(chat.id)}>
                  {chat.title}
                </button>
                <button type="button" className="history-delete" onClick={() => onDeleteChat(chat.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="ghost side-button" onClick={onLogout}>
            Logout
          </button>
        </>
      )}
    </aside>
  );
}
