"use client";

import { useEffect, useState } from "react";

type Props = { label: string; lightLabel: string; darkLabel: string };

export function ThemeToggle({ label, lightLabel, darkLabel }: Props) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable; the choice just won't persist */
    }
    setTheme(next);
  }

  return (
    <button type="button" className="btn" onClick={toggle} aria-label={label}>
      {theme === "light" ? darkLabel : lightLabel}
    </button>
  );
}
