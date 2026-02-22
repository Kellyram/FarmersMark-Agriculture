import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

type Role = "user" | "assistant";
type View = "landing" | "login" | "signup" | "chat";

type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: string[];
};

type StoredMessage = {
  role: Role;
  content: string;
  sources?: string[];
};

type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
};

type ChatResponse = {
  answer: string;
  sources: string[];
};

const starter = "Welcome to FarmersMark RAG. Ask about policies, market systems, or agronomy from your corpus.";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function cleanMarkdownAsterisks(content: string): string {
  return content.replace(/^\s*\*\s+/gm, "- ").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

function fromStoredMessages(items: StoredMessage[]): Message[] {
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), role: "assistant", content: starter }];
  }
  return items.map((m) => ({ id: crypto.randomUUID(), role: m.role, content: m.content, sources: m.sources }));
}

function toStoredMessages(items: Message[]): StoredMessage[] {
  return items
    .filter((m) => !(m.role === "assistant" && m.content === starter))
    .map((m) => ({ role: m.role, content: m.content, sources: m.sources }));
}

function makeTitle(messages: StoredMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Chat";
  return firstUser.content.slice(0, 64) || "New Chat";
}

export default function App() {
  const [view, setView] = useState<View>("landing");
  const [displayName, setDisplayName] = useState("Farmer");
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupError, setSignupError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const isGuest = !authUser;

  const transcript = useMemo(() => messages.filter((m) => m.role !== "assistant" || m.content !== starter), [messages]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setDisplayName("Farmer");
        setConversations([]);
        setActiveChatId(null);
        return;
      }
      const name = user.displayName?.trim() || user.email?.split("@")[0] || "Farmer";
      setDisplayName(name);
      setView("chat");
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const chatsRef = collection(db, "users", authUser.uid, "chats");
    const q = query(chatsRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const next: Conversation[] = snap.docs.map((d) => {
        const raw = d.data() as {
          title?: string;
          updatedAt?: number;
          messages?: StoredMessage[];
        };
        return {
          id: d.id,
          title: raw.title || "New Chat",
          updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
          messages: Array.isArray(raw.messages) ? raw.messages : []
        };
      });
      setConversations(next);
      if (!activeChatId && next.length > 0) {
        setActiveChatId(next[0].id);
        setMessages(fromStoredMessages(next[0].messages));
      } else if (activeChatId) {
        const active = next.find((c) => c.id === activeChatId);
        if (active) {
          setMessages(fromStoredMessages(active.messages));
        } else {
          setActiveChatId(next[0]?.id ?? null);
          setMessages(next[0] ? fromStoredMessages(next[0].messages) : [{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
        }
      }
    });
    return () => unsub();
  }, [authUser, activeChatId]);

  async function ensureUserProfile(user: User) {
    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        updatedAt: Date.now(),
        createdAt: Date.now()
      },
      { merge: true }
    );
  }

  async function persistMessages(nextMessages: Message[]) {
    if (!authUser) return;
    const stored = toStoredMessages(nextMessages);
    const now = Date.now();
    const title = makeTitle(stored);
    if (activeChatId) {
      await updateDoc(doc(db, "users", authUser.uid, "chats", activeChatId), {
        title,
        messages: stored,
        updatedAt: now
      });
      return;
    }
    const created = await addDoc(collection(db, "users", authUser.uid, "chats"), {
      title,
      messages: stored,
      createdAt: now,
      updatedAt: now
    });
    setActiveChatId(created.id);
  }

  async function persistMessagesSafe(nextMessages: Message[]) {
    try {
      await persistMessages(nextMessages);
    } catch (error) {
      console.error("Failed to persist chat history", error);
    }
  }

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
    await persistMessagesSafe(nextMessages);

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
        let details = `Request failed: ${response.status}`;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) {
            details = payload.error;
          }
        } catch {
          // Ignore parse failures and keep status fallback.
        }
        throw new Error(details);
      }

      const data = (await response.json()) as ChatResponse;
      const withAnswer = [
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: data.answer,
          sources: data.sources
        }
      ];
      setMessages(withAnswer);
      await persistMessagesSafe(withAnswer);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unknown error";
      const withError = [
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `I could not process that request. ${text}`
        }
      ];
      setMessages(withError);
      await persistMessagesSafe(withError);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function onStop() {
    abortRef.current?.abort();
  }

  async function onGoogleAuth() {
    setLoginError("");
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Google sign-in failed.";
      setLoginError(text);
    } finally {
      setAuthLoading(false);
    }
  }

  async function onEmailSignIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError("Email and password are required.");
      return;
    }
    setLoginError("");
    setAuthLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserProfile(result.user);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Sign in failed.";
      setLoginError(text);
    } finally {
      setAuthLoading(false);
    }
  }

  async function onEmailSignUp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setSignupError("Name, email, and password are required.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match.");
      return;
    }
    setSignupError("");
    setAuthLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, signupEmail.trim(), signupPassword);
      if (signupName.trim()) {
        await updateProfile(result.user, { displayName: signupName.trim() });
      }
      await ensureUserProfile(result.user);
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setSignupConfirm("");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Sign up failed.";
      setSignupError(text);
    } finally {
      setAuthLoading(false);
    }
  }

  async function onDeleteChat(chatId: string) {
    if (!authUser) return;
    await deleteDoc(doc(db, "users", authUser.uid, "chats", chatId));
    if (chatId === activeChatId) {
      setActiveChatId(null);
      setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
    }
  }

  function onNewChat() {
    setActiveChatId(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
  }

  async function onLogout() {
    await signOut(auth);
    setConversations([]);
    setActiveChatId(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
    setView("landing");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo" onClick={() => setView("landing")} role="button" tabIndex={0}>
          <span className="logo-dot" />
          <div>
            <strong>FarmersMark</strong>
            <small>RAG Intelligence Hub</small>
          </div>
        </div>
        <nav className="menu">
          <button type="button" className="link" onClick={() => setView("landing")}>
            Home
          </button>
          <button type="button" className="link" onClick={() => setView("login")}>
            Login
          </button>
          <button type="button" className="link" onClick={() => setView("signup")}>
            Sign Up
          </button>
          <button type="button" className="cta" onClick={() => setView("chat")}>
            Open Assistant
          </button>
        </nav>
      </header>

      {view === "landing" ? (
        <main className="landing">
          <section className="hero card">
            <div>
              <p className="eyebrow">Built For Agricultural Teams</p>
              <h1>Production-Ready FarmersMark RAG System</h1>
              <p>
                FarmersMark combines Vertex AI retrieval with grounded generation so teams can ask policy, market, and
                crop questions and get source-backed answers quickly.
              </p>
              <div className="hero-actions">
                <button type="button" className="cta" onClick={() => setView("signup")}>
                  Create Account
                </button>
                <button type="button" className="ghost" onClick={() => setView("chat")}>
                  Continue As Guest
                </button>
                <button type="button" className="ghost" onClick={() => setView("login")}>
                  Sign In
                </button>
              </div>
            </div>
            <div className="hero-panel">
              <h3>How It Works</h3>
              <ol>
                <li>Retrieve context from your Vertex RAG corpus.</li>
                <li>Ground response to retrieved chunks only.</li>
                <li>Cite section tokens and source URIs.</li>
              </ol>
            </div>
          </section>

          <section className="feature-grid">
            <article className="card">
              <h3>Grounded Answers</h3>
              <p>No unsupported claims. If context is missing, the assistant tells you exactly what is needed.</p>
            </article>
            <article className="card">
              <h3>Saved Chat History</h3>
              <p>Each user has their own stored chats and can continue where they stopped.</p>
            </article>
            <article className="card">
              <h3>Field-Friendly Output</h3>
              <p>Transforms dense language into plain English with concise summaries and source references.</p>
            </article>
            <article className="card">
              <h3>User Chat Control</h3>
              <p>Start new chats, open previous sessions, and delete outdated conversations any time.</p>
            </article>
          </section>
        </main>
      ) : null}

      {view === "login" ? (
        <main className="login-wrap">
          <section className="card login-card">
            <div className="login-intro">
              <p className="eyebrow">Secure Access</p>
              <h2>Sign In To FarmersMark RAG</h2>
              <p>Use Google or email authentication to access grounded agricultural intelligence.</p>
            </div>
            <form className="login-form" onSubmit={onEmailSignIn}>
              <button type="button" className="cta" onClick={onGoogleAuth} disabled={authLoading}>
                Continue with Google
              </button>
              <div className="divider">or continue with email</div>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@farmersmark.org" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
              </label>
              {loginError ? <p className="error">{loginError}</p> : null}
              <button type="submit" className="cta" disabled={authLoading}>
                Sign In
              </button>
              <button type="button" className="ghost" onClick={() => setView("signup")}>
                Need an account? Sign Up
              </button>
              <button type="button" className="ghost" onClick={() => setView("landing")}>
                Back To Home
              </button>
            </form>
          </section>
        </main>
      ) : null}

      {view === "signup" ? (
        <main className="login-wrap">
          <section className="card login-card">
            <div className="login-intro">
              <p className="eyebrow">New Account</p>
              <h2>Create FarmersMark Profile</h2>
              <p>Your profile and chat history are stored under your account.</p>
            </div>
            <form className="login-form" onSubmit={onEmailSignUp}>
              <label>
                Full Name
                <input type="text" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="Your name" />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="name@farmersmark.org"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create password"
                />
              </label>
              <label>
                Confirm Password
                <input
                  type="password"
                  value={signupConfirm}
                  onChange={(e) => setSignupConfirm(e.target.value)}
                  placeholder="Confirm password"
                />
              </label>
              {signupError ? <p className="error">{signupError}</p> : null}
              <button type="submit" className="cta" disabled={authLoading}>
                Create Account
              </button>
              <button type="button" className="ghost" onClick={() => setView("login")}>
                Already have an account? Login
              </button>
            </form>
          </section>
        </main>
      ) : null}

      {view === "chat" ? (
        <main className="assistant">
          <aside className="assistant-side">
            <h3>Session</h3>
            <p>
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
              <div className="chat-history">
                <h4>History</h4>
                <p className="muted">Guest chats are not saved. Sign in to keep history.</p>
                <button type="button" className="ghost side-button" onClick={() => setView("login")}>
                  Sign In To Save Chats
                </button>
              </div>
            ) : (
              <>
                <div className="chat-history">
                  <h4>History</h4>
                  {conversations.length === 0 ? <p className="muted">No saved chats yet.</p> : null}
                  {conversations.map((chat) => (
                    <div key={chat.id} className={`history-item ${chat.id === activeChatId ? "active" : ""}`}>
                      <button type="button" className="history-open" onClick={() => setActiveChatId(chat.id)}>
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

          <section className="assistant-main card">
            <div className="messages">
              {messages.map((message) => (
                <article key={message.id} className={`bubble ${message.role}`}>
                  <header>{message.role === "user" ? "You" : "Assistant"}</header>
                  <p>{cleanMarkdownAsterisks(message.content)}</p>
                  {message.sources && message.sources.length > 0 ? (
                    <ul className="sources">
                      {message.sources.map((source, idx) => (
                        <li key={`${source}-${idx}`}>{source}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>

            <form className="composer" onSubmit={onSubmit}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about any document in your FarmersMark corpus..."
                rows={3}
              />
              <div className="actions">
                {loading ? (
                  <button type="button" className="ghost" onClick={onStop}>
                    Stop
                  </button>
                ) : null}
                <button type="submit" className="cta" disabled={loading || !input.trim()}>
                  Send
                </button>
              </div>
            </form>
          </section>
        </main>
      ) : null}
    </div>
  );
}
