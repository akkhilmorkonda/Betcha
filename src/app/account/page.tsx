"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { authClient, signOut } from "@/lib/auth-client";

type Me = { id: string; name: string; email: string } | null;

/** Typed exactly, so a mis-click cannot delete an account. */
const CONFIRM_PHRASE = "delete my account";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await fetch("/api/session").then((r) => r.json());
    if (!s.user) {
      router.replace("/signin?next=/account");
      return;
    }
    setMe({ id: s.user.id, name: s.user.name, email: s.user.email });
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Both gates are checked here so the destructive call is never even
    // attempted on a half-filled form.
    if (phrase.trim().toLowerCase() !== CONFIRM_PHRASE) {
      return setErr(`Type "${CONFIRM_PHRASE}" exactly to confirm`);
    }
    if (!password) return setErr("Enter your password");

    setBusy(true);
    const res = await authClient.deleteUser({ password });
    setBusy(false);

    if (res.error) {
      return setErr(res.error.message ?? "That did not work — check your password");
    }
    // The session is gone server-side; don't leave a stale client session behind.
    router.replace("/signin");
    router.refresh();
  }

  if (loading) return <main className="p-8 text-muted">Loading…</main>;
  if (!me) return null;

  const input = "w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col gap-5 px-5 py-8">
      <header className="flex items-center gap-3">
        <Avatar name={me.name} size={40} />
        <div className="min-w-0">
          <div className="font-bold tracking-tight truncate">{me.name}</div>
          <div className="text-[13px] text-muted truncate">{me.email}</div>
        </div>
      </header>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/signin");
          router.refresh();
        }}
        className="w-full rounded-lg border border-edge px-3 py-2 text-sm hover:text-white"
      >
        Sign out
      </button>

      <section className="card p-4 flex flex-col gap-3">
        <span className="pill">Delete account</span>

        {/*
          Guideline 5.1.1(v) requires this to exist, and it also requires the
          description to be accurate. Deletion here scrubs the person and keeps
          the ledger — say so plainly rather than implying the bets vanish.
        */}
        <div className="text-[13px] text-muted leading-relaxed flex flex-col gap-2">
          <p>
            Your name, email and photo are erased, your password and every signed-in
            session are destroyed, and you will not be able to sign in again. This
            cannot be undone.
          </p>
          <p>
            Bets you took part in stay in their circles, shown as{" "}
            <span className="text-text">Deleted member</span>. They are other
            people&#39;s history too — balances and results would stop adding up if
            they disappeared.
          </p>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-lg border border-no text-no px-3 py-2 text-sm"
          >
            Delete my account
          </button>
        ) : (
          <form onSubmit={onDelete} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="pill">Password</span>
              <input
                className={input}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErr(null); }}
                autoComplete="current-password"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="pill">Type &quot;{CONFIRM_PHRASE}&quot;</span>
              <input
                className={input}
                value={phrase}
                onChange={(e) => { setPhrase(e.target.value); setErr(null); }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>

            {err && <p className="text-sm text-no">{err}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setPassword(""); setPhrase(""); setErr(null); }}
                className="flex-1 rounded-lg border border-edge px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-no text-ink px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "…" : "Delete forever"}
              </button>
            </div>
          </form>
        )}
      </section>

      <Link href="/" className="text-sm text-muted hover:text-text">
        ← Back
      </Link>
    </main>
  );
}
