"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "resulens-theme";
const EVENT = "resulens-theme-change";
const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

function parseTheme(value: string | null | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#090909" : "#f8f9fc");
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function getSnapshot() {
  return parseTheme(document.documentElement.dataset.themePreference);
}

// Keep system changes and other tabs in sync without tying themes to authentication.
export function ThemeSync() {
  useEffect(() => {
    let preference = parseTheme(document.documentElement.dataset.themePreference);
    try {
      preference = parseTheme(localStorage.getItem(KEY));
    } catch {
      /* Storage may be disabled. */
    }
    applyTheme(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getSnapshot() === "system") applyTheme("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) applyTheme(parseTheme(event.newValue));
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}

export function ThemeOptions({ inMenu = false }: Readonly<{ inMenu?: boolean }>) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as Theme);
  return (
    <div className="theme-options" role="group" aria-label="Appearance">
      <span className="theme-options-label">Appearance</span>
      <div className="theme-segments" role="group" aria-label="Color theme">
        {options.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role={inMenu ? "menuitemradio" : undefined}
            aria-checked={inMenu ? theme === value : undefined}
            aria-pressed={inMenu ? undefined : theme === value}
            onClick={() => {
              try {
                localStorage.setItem(KEY, value);
              } catch {
                /* The current session still works. */
              }
              applyTheme(value);
            }}
          >
            <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Visitors need access before they have an account menu.
export function VisitorThemeMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  return (
    <div
      className="visitor-theme"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        className="theme-trigger"
        type="button"
        aria-label="Choose color theme"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Sun size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>
      {open && (
        <div className="theme-popover">
          <ThemeOptions />
        </div>
      )}
    </div>
  );
}
