import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { WORKSPACE_FOCUS_STORAGE_KEY } from "@/types/workspace-focus.types";

interface WorkspaceFocusValue {
  /** The remembered preference. Stays true even when no focus-capable page is mounted. */
  focusPreferred: boolean;
  setFocusPreferred: (next: boolean) => void;
  /** focusPreferred AND a focus-capable page is currently mounted. The layouts read THIS. */
  chromeHidden: boolean;
  /** Called by a focus-capable page on mount (true) and unmount (false). */
  registerFocusScope: (active: boolean) => void;
}

const Ctx = createContext<WorkspaceFocusValue | null>(null);

const readStoredPreference = (): boolean => {
  try {
    return localStorage.getItem(WORKSPACE_FOCUS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

// S29 — the POS page owns the focus-mode toggle, but the header/sidebar it hides are owned by
// AdminLayout/StaffLayout, which are the POS page's ANCESTORS. A context is the only way the
// state can travel upwards. Modelled on LanguageProvider.tsx (createContext + null-guarded
// useX() throw).
//
// Two flags, not one: the preference must survive across sessions, but focus mode must apply
// ONLY on a focus-capable page (today, just POS) — a counter who left focus mode on must not
// find /admin/settings rendering with no navigation at all. chromeHidden = focusPreferred AND
// scopeCount > 0 gives both.
export function WorkspaceFocusProvider({ children }: { children: ReactNode }) {
  const [focusPreferred, setFocusPreferredState] = useState<boolean>(readStoredPreference);
  const [scopeCount, setScopeCount] = useState(0);

  const setFocusPreferred = useCallback((next: boolean) => {
    setFocusPreferredState(next);
    try {
      localStorage.setItem(WORKSPACE_FOCUS_STORAGE_KEY, String(next));
    } catch {
      // Storage disabled/full — the preference still works for this session, it just won't persist.
    }
  }, []);

  // Stable identity is load-bearing — useWorkspaceFocusScope's effect depends on it; an unstable
  // one would register/unregister on every render. A counter (not a bool) keeps React StrictMode's
  // dev-only mount -> unmount -> mount cycle balanced.
  const registerFocusScope = useCallback((active: boolean) => {
    setScopeCount((n) => n + (active ? 1 : -1));
  }, []);

  const value: WorkspaceFocusValue = {
    focusPreferred,
    setFocusPreferred,
    chromeHidden: focusPreferred && scopeCount > 0,
    registerFocusScope,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspaceFocus(): WorkspaceFocusValue {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWorkspaceFocus outside provider");
  return c;
}

// Declares "this page supports focus mode". Mount/unmount registration is what confines focus mode
// to the POS while still remembering the preference globally.
export function useWorkspaceFocusScope(): WorkspaceFocusValue {
  const ctx = useWorkspaceFocus();
  const { registerFocusScope } = ctx;
  useEffect(() => {
    registerFocusScope(true);
    return () => registerFocusScope(false);
  }, [registerFocusScope]);
  return ctx;
}
