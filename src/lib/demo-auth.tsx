"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClientBrowser, hasSupabaseEnv } from "@/lib/supabase-browser";

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
  loginWithPassword: (email: string, password: string) => Promise<DemoUser>;
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

      if (!hasSupabaseEnv()) return;

      try {
        const supabase = createClientBrowser();
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;

        const nextUser = await getSupabaseProfileUser(data.user.id, data.user.email || "");
        if (active) setUser(nextUser);
      } catch {
        // Demo auth remains available when Supabase session lookup is unavailable.
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
      async loginWithPassword(email, password) {
        const supabase = createClientBrowser();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error || !data.user) {
          throw new Error(error?.message || "Unable to sign in.");
        }

        const fullUser = await getSupabaseProfileUser(data.user.id, data.user.email || email);

        if (!canManageResort(fullUser.role)) {
          await supabase.auth.signOut();
          throw new Error("This Supabase user is not marked as admin or staff.");
        }

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
        if (hasSupabaseEnv()) {
          try {
            await createClientBrowser().auth.signOut();
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

async function getSupabaseProfileUser(id: string, fallbackEmail: string): Promise<DemoUser> {
  const supabase = createClientBrowser();
  const { data, error } = await supabase
    .from("users")
    .select("email, full_name, phone, role")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);

  return {
    id,
    name: data.full_name || data.email || fallbackEmail || "Supabase user",
    email: data.email || fallbackEmail,
    phone: data.phone || "",
    role: canManageResort(data.role) ? data.role : "guest",
  };
}

export function canManageResort(role: string | null | undefined): role is "admin" | "staff" {
  return role === "admin" || role === "staff";
}
