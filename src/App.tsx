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
import ChatWorkspace from "./chat/components/ChatWorkspace";
import { CHAT_SIDEBAR_STORAGE_KEY, STARTER_MESSAGE } from "./chat/constants";
import { useChatTheme } from "./chat/hooks/useChatTheme";
import {
  ChatApiError,
  ChatMode,
  ChatResponse,
  Conversation,
  Message,
  StoredMessage
} from "./chat/types";

type View = "landing" | "login" | "signup" | "chat";
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function readSidebarPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

function isChatApiError(value: unknown): value is ChatApiError {
  if (!value || typeof value !== "object") return false;
  return "error" in value && typeof (value as { error?: unknown }).error === "string";
}

function normalizeSources(sources: unknown): string[] | undefined {
  if (!Array.isArray(sources)) return undefined;
  const cleaned = sources
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function sanitizeAssistantContent(content: string): string {
  const withoutDisclaimer = content.replace(
    /\bThis is only an explanation and not legal help\.?/gi,
    ""
  );
  const withoutReferences = withoutDisclaimer.replace(/\n*\s*References\s*:[\s\S]*$/i, "");
  const cleaned = withoutReferences
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || content.trim();
}

function fromStoredMessages(items: StoredMessage[]): Message[] {
  if (items.length === 0) {
    return [{ id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }];
  }
  return items.map((m) => {
    const content = m.role === "assistant" ? sanitizeAssistantContent(m.content) : m.content;
    const sources = normalizeSources(m.sources);
    return sources
      ? { id: crypto.randomUUID(), role: m.role, content, sources }
      : { id: crypto.randomUUID(), role: m.role, content };
  });
}

function toStoredMessages(items: Message[]): StoredMessage[] {
  return items
    .filter((m) => !(m.role === "assistant" && m.content === STARTER_MESSAGE))
    .map((m) => {
      const content = m.role === "assistant" ? sanitizeAssistantContent(m.content) : m.content;
      const sources = normalizeSources(m.sources);
      return sources ? { role: m.role, content, sources } : { role: m.role, content };
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
  const [chatMode, setChatMode] = useState<ChatMode>("existing");
  const [messages, setMessages] = useState<Message[]>([
    { id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }
  ]);
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
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarPreference);
  const [typingMessageKey, setTypingMessageKey] = useState<string | null>(null);
  const [typingText, setTypingText] = useState("");
  const [lastRetryablePrompt, setLastRetryablePrompt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const activeChatIdRef = useRef<string | null>(null);
  const chatModeRef = useRef<ChatMode>("existing");
  const { theme, toggleTheme } = useChatTheme();
  const isGuest = !authUser;

  const transcript = useMemo(
    () => messages.filter((m) => m.role !== "assistant" || m.content !== STARTER_MESSAGE),
    [messages]
  );
  const hasGuestResponses =
    isGuest && messages.some((m) => m.role === "assistant" && m.content !== STARTER_MESSAGE);
  const isChatView = view === "chat";

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setDisplayName("Farmer");
        setConversations([]);
        setActiveChatId(null);
        setChatMode("existing");
        setLastRetryablePrompt(null);
        return;
      }
      const name = user.displayName?.trim() || user.email?.split("@")[0] || "Farmer";
      setDisplayName(name);
      setChatMode("existing");
      setView("chat");
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatModeRef.current = chatMode;
  }, [chatMode]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

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

      if (chatModeRef.current === "draft") return;
      if (typingActiveRef.current) return;

      const selectedId = activeChatIdRef.current;
      if (!selectedId) {
        if (next.length > 0) {
          setActiveChatId(next[0].id);
          setMessages(fromStoredMessages(next[0].messages));
        } else {
          setMessages([{ id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }]);
        }
        return;
      }

      const active = next.find((c) => c.id === selectedId);
      if (active) {
        setMessages(fromStoredMessages(active.messages));
        return;
      }

      setActiveChatId(next[0]?.id ?? null);
      setMessages(
        next[0]
          ? fromStoredMessages(next[0].messages)
          : [{ id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }]
      );
    });
    return () => unsub();
  }, [authUser]);

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

  async function persistMessages(
    nextMessages: Message[],
    chatIdOverride?: string | null
  ): Promise<string | null> {
    const resolvedChatId = chatIdOverride ?? activeChatIdRef.current;
    if (!authUser) return resolvedChatId;
    const stored = toStoredMessages(nextMessages);
    const now = Date.now();
    const title = makeTitle(stored);
    if (resolvedChatId) {
      await updateDoc(doc(db, "users", authUser.uid, "chats", resolvedChatId), {
        title,
        messages: stored,
        updatedAt: now
      });
      return resolvedChatId;
    }
    const created = await addDoc(collection(db, "users", authUser.uid, "chats"), {
      title,
      messages: stored,
      createdAt: now,
      updatedAt: now
    });
    setActiveChatId(created.id);
    setChatMode("existing");
    return created.id;
  }

  async function persistMessagesSafe(
    nextMessages: Message[],
    chatIdOverride?: string | null
  ): Promise<string | null> {
    try {
      return await persistMessages(nextMessages, chatIdOverride);
    } catch (error) {
      console.error("Failed to persist chat history", error);
      return chatIdOverride ?? activeChatIdRef.current;
    }
  }

  async function submitPrompt(promptOverride?: string) {
    const trimmed = (promptOverride ?? input).trim();
    if (!trimmed || loading) return;
    stopTypingAnimation();
    setLastRetryablePrompt(null);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    let workingChatId = await persistMessagesSafe(nextMessages, activeChatIdRef.current);
    if (workingChatId) {
      setActiveChatId(workingChatId);
      setChatMode("existing");
    }

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
        let details: ChatApiError = {
          error: `Request failed: ${response.status}`,
          status: response.status
        };
        try {
          const payload = (await response.json()) as Partial<ChatApiError>;
          details = {
            error: typeof payload.error === "string" ? payload.error : details.error,
            status: typeof payload.status === "number" ? payload.status : response.status,
            code: typeof payload.code === "string" ? payload.code : undefined,
            retryable: typeof payload.retryable === "boolean" ? payload.retryable : false
          };
        } catch {
          // Ignore parse failures and keep status fallback.
        }
        throw details;
      }

      const data = (await response.json()) as ChatResponse;
      const answerText =
        typeof data.answer === "string"
          ? sanitizeAssistantContent(data.answer)
          : "I do not have an answer.";
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
      startTypingAnimation(assistantMessage.id, assistantMessage.content);
      workingChatId = await persistMessagesSafe(withAnswer, workingChatId);
      if (workingChatId) {
        setActiveChatId(workingChatId);
        setChatMode("existing");
      }
      setLastRetryablePrompt(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      const apiError = isChatApiError(error) ? error : null;
      const retryable =
        !!apiError?.retryable ||
        apiError?.status === 429 ||
        apiError?.code === "RESOURCE_EXHAUSTED";
      const content = retryable
        ? "The assistant is temporarily at capacity. Please retry shortly."
        : "I could not process that request right now. Please try again.";

      setLastRetryablePrompt(retryable ? trimmed : null);
      const assistantErrorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content
      };
      const withError = [
        ...nextMessages,
        assistantErrorMessage
      ];
      setMessages(withError);
      startTypingAnimation(assistantErrorMessage.id, assistantErrorMessage.content);
      workingChatId = await persistMessagesSafe(withError, workingChatId);
      if (workingChatId) {
        setActiveChatId(workingChatId);
        setChatMode("existing");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await submitPrompt();
  }

  async function onRetry() {
    if (!lastRetryablePrompt) return;
    await submitPrompt(lastRetryablePrompt);
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
    if (chatId === activeChatIdRef.current) {
      stopTypingAnimation();
      setActiveChatId(null);
      setChatMode("existing");
    }
  }

  function onSelectChat(chatId: string) {
    stopTypingAnimation();
    setLastRetryablePrompt(null);
    setChatMode("existing");
    setActiveChatId(chatId);
  }

  function onNewChat() {
    abortRef.current?.abort();
    stopTypingAnimation();
    setLoading(false);
    setInput("");
    setLastRetryablePrompt(null);
    setChatMode("draft");
    setActiveChatId(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }]);
  }

  async function onLogout() {
    abortRef.current?.abort();
    stopTypingAnimation();
    await signOut(auth);
    setConversations([]);
    setActiveChatId(null);
    setChatMode("existing");
    setLastRetryablePrompt(null);
    setMessages([{ id: crypto.randomUUID(), role: "assistant", content: STARTER_MESSAGE }]);
    setView("landing");
  }

  function stopTypingAnimation() {
    typingActiveRef.current = false;
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setTypingMessageKey(null);
    setTypingText("");
  }

  function startTypingAnimation(messageKey: string, fullContent: string) {
    const total = fullContent.length;
    if (total === 0) {
      stopTypingAnimation();
      return;
    }

    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
    }

    typingActiveRef.current = true;
    setTypingMessageKey(messageKey);
    setTypingText("");

    const intervalMs = 30;
    const durationMs = Math.min(Math.max(total * 30, 3200), 12000);
    const ticks = Math.ceil(durationMs / intervalMs);
    const step = Math.max(1, Math.ceil(total / ticks));
    let cursor = 0;

    typingTimerRef.current = window.setInterval(() => {
      cursor = Math.min(total, cursor + step);
      setTypingText(fullContent.slice(0, cursor));
      if (cursor >= total) {
        typingActiveRef.current = false;
        if (typingTimerRef.current !== null) {
          window.clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        setTypingMessageKey(null);
      }
    }, intervalMs);
  }

  return (
    <div className={`app ${isChatView ? "chat-mode" : ""}`} data-chat-theme={theme}>
      {!isChatView ? (
        <header className="topbar">
          <div className="logo" onClick={() => setView("landing")} role="button" tabIndex={0}>
            <span className="logo-dot" />
            <div>
              <strong>FarmersMark Agriculture</strong>
              <small>Grounded RAG Intelligence</small>
            </div>
          </div>
          <nav className="menu">
            <button type="button" className="ghost" onClick={() => setView("login")}>
              Login
            </button>
            <button type="button" className="cta" onClick={() => setView("signup")}>
              Create Account
            </button>
          </nav>
        </header>
      ) : null}

      {view === "landing" ? (
        <main className="landing">
          <section className="hero hero-photo card">
            <div className="hero-copy">
              <p className="eyebrow">FarmersMark Agriculture</p>
              <h1>The Ultimate AI Assistant for Every Farmer and Agribusiness</h1>
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
                <li>Retrieve only from your configured agriculture trusted source.</li>
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
                Am a agrodealer
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
              <h2>Sign In To FarmersMark Agriculture</h2>
              <p>Continue with Google or email to unlock full answers, follow-ups, and saved chat history.</p>
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
            <div className="login-intro signup-photo">
              <p className="eyebrow">New Account</p>
              <h2>Create FarmersMark Agriculture Profile</h2>
              <p>Use one account to continue agronomy, market, and policy conversations from any device.</p>
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
        <ChatWorkspace
          displayName={displayName}
          isGuest={isGuest}
          conversations={conversations}
          activeChatId={activeChatId}
          messages={messages}
          input={input}
          loading={loading}
          canRetry={!!lastRetryablePrompt}
          hasGuestResponses={hasGuestResponses}
          typingMessageKey={typingMessageKey}
          typingText={typingText}
          theme={theme}
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={setSidebarOpen}
          onToggleTheme={toggleTheme}
          onInputChange={setInput}
          onSubmit={onSubmit}
          onRetry={onRetry}
          onStop={onStop}
          onNewChat={onNewChat}
          onSelectChat={onSelectChat}
          onDeleteChat={onDeleteChat}
          onLogout={onLogout}
          onGoHome={() => setView("landing")}
          onOpenLogin={() => setView("login")}
          onOpenSignup={() => setView("signup")}
        />
      ) : null}
    </div>
  );
}
