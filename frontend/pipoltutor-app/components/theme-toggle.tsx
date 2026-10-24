"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY as KEY } from "@/lib/theme";

import { Icon } from "./ui";

type Theme = "light" | "dark";

const CHANGE = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** Light/dark switch; the choice is saved per browser. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server: the icon appears once the real theme is known.
  const theme = useSyncExternalStore<Theme | null>(subscribe, readTheme, () => null);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private mode or blocked storage: the switch still works for this page.
    }
    window.dispatchEvent(new Event(CHANGE));
  }

  const label = dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex size-[42px] shrink-0 items-center justify-center rounded-[14px] border-[1.5px] border-border bg-page text-ink transition-colors hover:border-border-strong ${className}`}
    >
      {theme ? <Icon name={dark ? "light_mode" : "dark_mode"} size={21} /> : null}
    </button>
  );
}
