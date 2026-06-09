"use client";

import { AuthProvider } from "@/lib/demo-auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
