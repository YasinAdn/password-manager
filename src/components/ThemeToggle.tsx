"use client";

import { useState } from "react";

type Theme = "dark" | "light";

function readCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export default function ThemeToggle() {
  // The inline script in layout.tsx already set the DOM attribute
  // synchronously before paint (avoiding a flash) -- this lazy initializer
  // just mirrors that into React state on mount, without a render-then-fix
  // effect.
  const [theme, setTheme] = useState<Theme>(readCurrentTheme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label="Toggle light/dark theme"
      onClick={toggle}
      className="flex items-center gap-2 rounded-full border border-border px-2 py-1"
    >
      <span aria-hidden className="text-xs">🌙</span>
      <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-background transition-colors">
        <span
          className={`absolute left-0.5 h-4 w-4 rounded-full bg-accent transition-transform ${
            isLight ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span aria-hidden className="text-xs">☀️</span>
    </button>
  );
}
