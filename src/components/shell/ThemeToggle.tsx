"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/primitives/icons";

/**
 * Theme switch (CLAUDE.md sections 12 + 14). Dark is the default; this flips the
 * `data-theme` attribute on <html>, which swaps ONLY the surface/text tokens
 * (accent + live colours stay). Proves the theme is a token swap, not a rewrite.
 * Persisted in localStorage; initial value is applied pre-paint by the inline
 * script in layout.tsx (no flash).
 */
const STORAGE_KEY = "allinfootball.theme";

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex items-center rounded-tile text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary ${
        collapsed ? "justify-center p-2" : "gap-3 px-3 py-2 text-body font-medium"
      }`}
    >
      {theme === "dark" ? <MoonIcon size={18} /> : <SunIcon size={18} />}
      {!collapsed && <span>{theme === "dark" ? "Dark" : "Light"} theme</span>}
    </button>
  );
}
