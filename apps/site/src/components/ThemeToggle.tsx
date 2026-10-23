import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;

  try {
    const stored = localStorage.getItem("markmap-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Theme still follows the system preference when storage is unavailable.
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("markmap-theme", theme);
    } catch {
      // Theme remains functional without persistence.
    }
  }, [theme]);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Mudar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
      title={`Mudar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
    >
      <span className="theme-toggle__sun" aria-hidden="true">
        ☼
      </span>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      <span className="theme-toggle__moon" aria-hidden="true">
        ◐
      </span>
    </button>
  );
}
