"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { canManageResort, useDemoAuth, type DemoRole } from "@/lib/demo-auth";
import { hasSupabaseEnv } from "@/lib/supabase-browser";

const adminCode = "BOLIHON-ADMIN";
const managementRoles = ["admin", "staff"] as const;

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get("role");
  const defaultRole: DemoRole = canManageResort(requestedRole) ? requestedRole : "guest";
  const [role, setRole] = useState<DemoRole>(defaultRole);
  const [name, setName] = useState(canManageResort(role) ? `BOLIHON ${role}` : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, loginWithPassword } = useDemoAuth();
  const supabaseConfigured = hasSupabaseEnv();

  const destination = useMemo(() => (canManageResort(role) ? "/admin" : "/rooms"), [role]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      if (canManageResort(role) && supabaseConfigured) {
        if (!email.trim() || !password) {
          setMessage("Enter the Supabase staff/admin email and password.");
          return;
        }

        await loginWithPassword(email.trim(), password);
        router.push(destination);
        return;
      }

      if (canManageResort(role) && code !== adminCode) {
        setMessage("Enter the correct admin access code. Demo code: BOLIHON-ADMIN");
        return;
      }

      if (role === "guest" && !phone.trim()) {
        setMessage("Cellphone number is required for guest booking follow-up.");
        return;
      }

      login({
        role,
        name: name.trim() || (canManageResort(role) ? `BOLIHON ${role}` : "Guest"),
        email: email.trim(),
        phone: phone.trim(),
      });
      router.push(destination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-xl gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-cyan-950/10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Account access</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Sign in to BOLIHON</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Guests can browse cottage details, make bookings, and chat with staff. Admin and staff users can manage bookings, cottage details, payments, and guest messages.
        </p>
      </div>

      <div className="grid grid-cols-3 rounded-full bg-slate-100 p-1 text-sm font-semibold">
        {(["guest", ...managementRoles] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setRole(item);
              setName(canManageResort(item) ? `BOLIHON ${item}` : "");
              setMessage("");
            }}
            className={`rounded-full px-3 py-2 capitalize transition ${role === item ? "bg-bolihon-green text-white" : "text-slate-600 hover:bg-white"}`}
          >
            {item} login
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Email" type="email" value={email} onChange={setEmail} required={canManageResort(role) && supabaseConfigured} />
        {canManageResort(role) && supabaseConfigured ? (
          <Field label="Password" type="password" value={password} onChange={setPassword} />
        ) : null}
        {role === "guest" ? (
          <Field label="Cellphone no." type="tel" value={phone} onChange={setPhone} required />
        ) : null}
        {canManageResort(role) && !supabaseConfigured ? (
          <Field label="Admin code" type="password" value={code} onChange={setCode} />
        ) : null}
      </div>

      <button
        disabled={submitting}
        className="rounded-full bg-bolihon-green px-5 py-3 text-sm font-semibold text-white transition hover:bg-bolihon-green-dark disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Signing in..." : `Continue as ${role}`}
      </button>
      {message ? <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p> : null}
    </form>
  );
}

function Field({
  label,
  type = "text",
  value,
  required = true,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\W+/g, "-");

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-3 outline-none ring-bolihon-green focus:ring-2"
      />
    </div>
  );
}
