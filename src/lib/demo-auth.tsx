"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasPersistentBackend } from "@/lib/backend-mode";

export type DemoRole = "guest" | "staff" | "admin";

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
  loginWithPassword: (identifier: string, password: string) => Promise<DemoUser>;
  logout: () => Promise<void>;
};

const storageKey = "bolihon-demo-user";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    let active = true;

    const timeout = window.setTimeout(async () => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (active) setUser(stored ? (JSON.parse(stored) as DemoUser) : null);
      } catch {
        if (active) setUser(null);
      }

      if (!hasPersistentBackend()) return;

      try {
        const response = await fetch("/api/auth/me");
        const result = (await response.json()) as { user?: DemoUser | null };
        if (!active || !result.user) return;

        setUser(toAppUser(result.user));
      } catch {
        // Demo auth remains available when the session lookup is unavailable.
      }
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
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
      async loginWithPassword(identifier, password) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const result = (await response.json()) as { user?: DemoUser; message?: string };

        if (!response.ok || !result.user) {
          throw new Error(result.message || "Unable to sign in.");
        }

        const fullUser = toAppUser(result.user);

        setUser(fullUser);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(fullUser));
        } catch {
          // Keep the in-memory session active if browser storage is blocked.
        }
        window.dispatchEvent(new Event("bolihon-auth-updated"));
        return fullUser;
      },
      async logout() {
        if (hasPersistentBackend()) {
          try {
            await fetch("/api/auth/logout", { method: "POST" });
          } catch {
            // Local state is still cleared below.
          }
        }

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

function toAppUser(user: DemoUser): DemoUser {
  return {
    id: user.id,
    name: user.name || user.email || "Staff user",
    email: user.email,
    phone: user.phone || "",
    role: canManageResort(user.role) ? user.role : "guest",
  };
}

export function canManageResort(role: string | null | undefined): role is "admin" | "staff" {
  return role === "admin" || role === "staff";
}
