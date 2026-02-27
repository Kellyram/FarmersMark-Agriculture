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
  sources?: string[];
};

const starter = "Welcome to FarmersMark RAG. Ask about policies, market systems, or agronomy from your corpus.";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function cleanMarkdownAsterisks(content: string): string {
  return content.replace(/^\s*\*\s+/gm, "- ").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1");
}

function normalizeSources(sources: unknown): string[] | undefined {
  if (!Array.isArray(sources)) return undefined;
  const cleaned = sources
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function fromStoredMessages(items: StoredMessage[]): Message[] {
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), role: "assistant", content: starter }];
  }
  return items.map((m) => {
    const sources = normalizeSources(m.sources);
    return sources
      ? { id: crypto.randomUUID(), role: m.role, content: m.content, sources }
      : { id: crypto.randomUUID(), role: m.role, content: m.content };
  });
}

function toStoredMessages(items: Message[]): StoredMessage[] {
  return items
    .filter((m) => !(m.role === "assistant" && m.content === starter))
    .map((m) => {
      const sources = normalizeSources(m.sources);
      return sources ? { role: m.role, content: m.content, sources } : { role: m.role, content: m.content };
    });
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [typingMessageKey, setTypingMessageKey] = useState<string | null>(null);
  const [typingText, setTypingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const isGuest = !authUser;

  const transcript = useMemo(() => messages.filter((m) => m.role !== "assistant" || m.content !== starter), [messages]);
  const isChatView = view === "chat";

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
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
      }
    };
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
    stopTypingAnimation();

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
      const answerText = typeof data.answer === "string" ? data.answer : "I do not have an answer.";
      const sources = normalizeSources(data.sources);
      const assistantMessage: Message = sources
        ? {
            id: crypto.randomUUID(),
            role: "assistant",
            content: answerText,
            sources
          }
        : {
            id: crypto.randomUUID(),
            role: "assistant",
            content: answerText
          };
      const withAnswer = [
        ...nextMessages,
        assistantMessage
      ];
      setMessages(withAnswer);
      startTypingAnimation(`${withAnswer.length - 1}:assistant:${assistantMessage.content}`, assistantMessage.content);
      await persistMessagesSafe(withAnswer);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unknown error";
      const assistantErrorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I could not process that request. ${text}`
      };
      const withError = [
        ...nextMessages,
        assistantErrorMessage
      ];
      setMessages(withError);
      startTypingAnimation(`${withError.length - 1}:assistant:${assistantErrorMessage.content}`, assistantErrorMessage.content);
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
      stopTypingAnimation();
      setActiveChatId(null);
      setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
    }
  }

  function onNewChat() {
    stopTypingAnimation();
    setActiveChatId(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
  }

  async function onLogout() {
    stopTypingAnimation();
    await signOut(auth);
    setConversations([]);
    setActiveChatId(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: starter }]);
    setView("landing");
  }

  function stopTypingAnimation() {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMessageKey(null);
    setTypingText("");
  }

  function startTypingAnimation(messageKey: string, fullContent: string) {
    const cleaned = cleanMarkdownAsterisks(fullContent);
    const total = cleaned.length;
    if (total === 0) {
      stopTypingAnimation();
      return;
    }

    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
    }

    setTypingMessageKey(messageKey);
    setTypingText("");

    const intervalMs = 28;
    const step = Math.max(1, Math.ceil(total / 80));
    let cursor = 0;

    typingTimerRef.current = window.setInterval(() => {
      cursor = Math.min(total, cursor + step);
      setTypingText(cleaned.slice(0, cursor));
      if (cursor >= total) {
        if (typingTimerRef.current !== null) {
          window.clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        setTypingMessageKey(null);
      }
    }, intervalMs);
  }

  return (
    <div className={`app ${isChatView ? "chat-mode" : ""}`}>
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
          <section className="hero hero-photo card">
            <div className="hero-copy">
              <p className="eyebrow">FarmersMark Agriculture</p>
              <h1>The Ultimate AI Assistant for Every Acre and Agribusiness</h1>
              <p>
                Stop digging through scattered reports. Ask our agriculture RAG engine about pest outbreaks, fertilizer
                inputs, market trends, and policy updates to get grounded answers in seconds.
              </p>
              <div className="hero-actions dual-cta">
                <button type="button" className="cta" onClick={() => setView("chat")}>
                  Open Assistant
                </button>
                <button type="button" className="ghost" onClick={() => setView("signup")}>
                  Create Account
                </button>
                <button type="button" className="ghost" onClick={() => setView("login")}>
                  Sign In
                </button>
              </div>
            </div>
            <div className="hero-panel">
              <h3>A better harvest with grounded AI</h3>
              <ol>
                <li>Retrieve only from your configured agriculture corpus.</li>
                <li>Generate plain-language answers from retrieved evidence.</li>
                <li>Keep source references visible for field-level trust.</li>
              </ol>
            </div>
          </section>

          <section className="role-split">
            <article className="role-card farmer-cta" id="farmer">
              <p>For farmers</p>
              <h3>Ask about your field before investing in inputs.</h3>
              <button type="button" className="ghost role-button" onClick={() => setView("chat")}>
                I am a farmer
              </button>
            </article>
            <article className="role-card dealer-cta" id="agrodealer">
              <p>For agrodealers</p>
              <h3>Support clients using source-backed guidance and policy context.</h3>
              <button type="button" className="ghost role-button" onClick={() => setView("signup")}>
                Am an agro-agent
              </button>
            </article>
          </section>

          <section className="about-section card" id="about">
            <div className="about-copy">
              <p className="eyebrow">What do we do?</p>
              <h2>We help small-scale farmers make better decisions with RAG.</h2>
              <p>
                FarmersMark Agriculture combines local crop intelligence, market context, and policy guidance in one
                practical assistant so teams can make faster, higher-confidence decisions.
              </p>
              <p>
                Knowledge areas include crop inputs, pest management, market access, and agriculture policy updates, all
                tied to retrievable sources.
              </p>
              <button type="button" className="cta" onClick={() => setView("chat")}>
                Learn more in chat
              </button>
            </div>
            <div className="about-photo" role="img" aria-label="Farmers collaborating at a grain collection point" />
          </section>

          <section className="quote-band">
            <p>
              Every farmer, everywhere, deserves grounded information to thrive. FarmersMark Agriculture turns retrieval
              and generation into practical decisions in the field.
            </p>
            <span>FarmersMark Team</span>
          </section>

          <section className="culture-section card" id="careers">
            <div className="culture-photo" role="img" aria-label="Agriculture specialist in a field" />
            <div className="culture-copy">
              <h2>Work life balance meets field impact.</h2>
              <p>
                Build AI tools that reduce uncertainty for farmers and agrodealers while keeping output grounded in
                trusted sources.
              </p>
              <button type="button" className="cta" onClick={() => setView("signup")}>
                Work with us
              </button>
            </div>
          </section>

          <section className="news-section" id="news">
            <article className="card news-card">
              <h3>Inputs</h3>
              <p>Compare fertilizer, seed, and crop protection guidance with referenced evidence.</p>
            </article>
            <article className="card news-card">
              <h3>Pests</h3>
              <p>Get practical intervention options for outbreaks with context-grounded recommendations.</p>
            </article>
            <article className="card news-card">
              <h3>Markets & Policy</h3>
              <p>Track market signals and policy shifts that influence planting, financing, and distribution.</p>
            </article>
          </section>

          <section className="gallery-strip">
            <div className="strip-photo strip-one" role="img" aria-label="Farmer in tea field" />
            <div className="strip-photo strip-two" role="img" aria-label="Farmers in workshop" />
            <div className="strip-photo strip-three" role="img" aria-label="Farmer in maize field" />
            <div className="strip-photo strip-four" role="img" aria-label="Farmers in local training program" />
          </section>
        </main>
      ) : null}

      {view === "login" ? (
        <main className="login-wrap">
          <section className="card login-card">
            <div className="login-intro login-photo">
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
            <div className="login-intro login-photo">
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
        <main className={`assistant ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
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
                <p className="muted">Guest chats are not saved.</p>
                <p className="muted">Create a free account to read the full answer, ask follow-ups, and save your chat history.</p>
                <div className="guest-upgrade-actions">
                  <button type="button" className="cta side-button" onClick={() => setView("signup")}>
                    Create Account
                  </button>
                  <button type="button" className="ghost side-button" onClick={() => setView("login")}>
                    Sign In
                  </button>
                </div>
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
            <div className="assistant-toolbar">
              <button
                type="button"
                className="sidebar-toggle"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen((open) => !open)}
              >
                {sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              </button>
            </div>
            <div className="messages">
              {messages.map((message, idx) => {
                const cleaned = cleanMarkdownAsterisks(message.content);
                const messageKey = `${idx}:${message.role}:${message.content}`;
                const isTyping = messageKey === typingMessageKey;
                const animatedText = isTyping ? typingText : cleaned;

                return (
                  <article key={message.id} className={`bubble ${message.role}`}>
                    <header>{message.role === "user" ? "You" : "Assistant"}</header>
                    <p>
                      {animatedText}
                      {isTyping ? <span className="typing-caret" aria-hidden="true">|</span> : null}
                    </p>
                    {message.role === "assistant" && message.sources && message.sources.length > 0 ? (
                      <ul className="sources">
                        {message.sources.map((source, srcIdx) => (
                          <li key={`${source}-${srcIdx}`}>{source}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                );
              })}
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
