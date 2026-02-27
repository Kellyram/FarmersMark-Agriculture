import { useEffect, useState } from "react";
import { CHAT_THEME_STORAGE_KEY } from "../constants";
import { ChatTheme } from "../types";

function readStoredTheme(): ChatTheme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(CHAT_THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

function getSystemTheme(): ChatTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useChatTheme() {
  const [theme, setTheme] = useState<ChatTheme>(() => readStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    window.localStorage.setItem(CHAT_THEME_STORAGE_KEY, theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return { theme, setTheme, toggleTheme };
}
