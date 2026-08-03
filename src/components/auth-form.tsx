"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDemoAuth } from "@/lib/demo-auth";

export function AuthForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { loginWithPassword } = useDemoAuth();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      if (!identifier.trim() || !password) throw new Error("Enter your username or email and password.");

      let email = identifier.trim();
      if (!email.includes("@")) {
        const response = await fetch("/api/auth/resolve-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email }),
        });
        const result = (await response.json()) as { email?: string; message?: string };
        if (!response.ok || !result.email) throw new Error(result.message || "Invalid username/email or password.");
        email = result.email;
      }

      await loginWithPassword(email, password);
      router.push("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Staff access</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Sign in to BOLIHON</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Authorized staff and administrators can manage bookings, cottages, payments, and guest messages.
        </p>
      </div>
      <Field label="Username or email" value={identifier} onChange={setIdentifier} autoComplete="username" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <button disabled={submitting} className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300">
        {submitting ? "Signing in..." : "Sign in"}
      </button>
      {message ? <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p> : null}
    </form>
  );
}

function Field({ label, type = "text", value, autoComplete, onChange }: { label: string; type?: string; value: string; autoComplete?: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
      <input id={id} type={type} required autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none ring-bolihon-green focus:ring-2" />
    </div>
  );
}
