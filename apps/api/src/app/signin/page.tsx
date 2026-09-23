"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

type Mode = "signin" | "signup";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!email.trim()) return setErr("Enter your email");
    if (!password) return setErr("Enter your password");
    if (mode === "signup" && !name.trim()) return setErr("Enter your name");

    setBusy(true);
    const res =
      mode === "signin"
        ? await signIn.email({ email: email.trim(), password })
        : await signUp.email({ email: email.trim(), password, name: name.trim() });
    setBusy(false);

    if (res.error) return setErr(res.error.message ?? "That did not work");
    router.push(next);
    router.refresh();
  }

  const input =
    "w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col justify-center gap-5 px-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {mode === "signin"
            ? "Your circles are tied to your account."
            : "You will start with no circles — create one or use an invite code."}
        </p>
      </div>

      <form onSubmit={submit} className="card p-4 flex flex-col gap-3">
        {mode === "signup" && (
          <label className="flex flex-col gap-1">
            <span className="pill">Name</span>
            <input
              className={input}
              value={name}
              onChange={(e) => { setName(e.target.value); setErr(null); }}
              autoComplete="name"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="pill">Email</span>
          <input
            className={input}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(null); }}
            autoComplete="email"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="pill">Password</span>
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErr(null); }}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        {err && <p className="text-sm text-no">{err}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-text text-ink disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); }}
        className="text-sm text-muted hover:text-text"
      >
        {mode === "signin"
          ? "No account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
