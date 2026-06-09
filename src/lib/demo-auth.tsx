"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type DemoRole = "guest" | "admin";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: DemoRole;
};

type AuthContextValue = {
  user: DemoUser | null;
  login: (user: Omit<DemoUser, "id">) => DemoUser;
  logout: () => void;
};

const storageKey = "bolihon-demo-user";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        setUser(stored ? (JSON.parse(stored) as DemoUser) : null);
      } catch {
        setUser(null);
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login(nextUser) {
        const fullUser = {
          ...nextUser,
          id: `${nextUser.role}-${nextUser.email || nextUser.phone || Date.now()}`,
        };
        setUser(fullUser);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(fullUser));
        } catch {
          // Keep the in-memory session active if browser storage is blocked.
        }
        window.dispatchEvent(new Event("bolihon-auth-updated"));
        return fullUser;
      },
      logout() {
        setUser(null);
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // Ignore storage failures; state is already cleared.
        }
        window.dispatchEvent(new Event("bolihon-auth-updated"));
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useDemoAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useDemoAuth must be used inside AuthProvider");
  return context;
}
