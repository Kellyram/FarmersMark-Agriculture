export type Role = "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: string[];
};

export type StoredMessage = {
  role: Role;
  content: string;
  sources?: string[];
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredMessage[];
};

export type ChatResponse = {
  answer: string;
  sources?: string[];
};

export type ChatApiError = {
  error: string;
  status?: number;
  code?: string;
  retryable?: boolean;
};

export type ChatTheme = "light" | "dark";

export type SourceAccordionState = Record<string, boolean>;

export type ChatMode = "existing" | "draft";
