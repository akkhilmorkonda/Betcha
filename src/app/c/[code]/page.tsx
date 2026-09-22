"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { TabBar } from "@/components/TabBar";
import { money, signed, mult, timeLeft } from "@/lib/format";

export default function CirclePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cRes, s] = await Promise.all([
      fetch(`/api/circle/${code}`),
      fetch("/api/session").then((r) => r.json()),
    ]);

    // Signed out is not "no such circle" — send them somewhere they can act.
    if (cRes.status === 401) {
      router.replace(`/signin?next=/c/${code}`);
      return;
    }

    const c = await cRes.json();
    if (c.error) {
      setErr(c.error);
      setData(null);
    } else {
      setErr(null);
      setData(c.circle ?? null);
    }
    setMeId(s.user?.id ?? null);
  }, [code, router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  // A blank screen tells you nothing at 3am. Say what broke and how to fix it.
  if (err)
    return (
      <main className="mx-auto max-w-md min-h-screen flex flex-col justify-center gap-4 px-6">
        <h1 className="text-xl font-bold">No circle here</h1>
        <p className="text-sm text-muted leading-relaxed">
          Nothing in the database has the invite code{" "}
          <span className="num text-text">{code}</span>. The database is almost
          certainly empty — load the demo circle:
        </p>
        <pre className="card p-3 text-[13px] num overflow-x-auto">npm run db:reset</pre>
        <button
          onClick={load}
          className="py-3 rounded-2xl bg-accent text-ink font-bold text-sm"
        >
          Try again
        </button>
      </main>
    );

  if (!data) return <div className="p-8 text-muted">Loading…</div>;

  const me = data.members.find((m: any) => m.userId === meId) ?? data.members[0];
  const rank = data.members.findIndex((m: any) => m.userId === me.userId) + 1;
  const latest = data.recent.find((r: any) => r.topWinner);

  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col">
      <div className="flex-1 px-5 pt-5 pb-28 flex flex-col gap-4">

        <header className="flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">{data.name}</span>
          <Avatar name={me.name} size={30} />
        </header>

        <section>
          <div className="num text-[42px] font-bold leading-none tracking-tight">{money(me.balance)}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`num text-[13px] ${me.weeklyChange >= 0 ? "text-yes" : "text-no"}`}>
              {me.weeklyChange >= 0 ? "▲" : "▼"} {money(Math.abs(me.weeklyChange))} this week
            </span>
            <span className="text-[13px] text-muted">· {rank} of {data.members.length}</span>
          </div>
        </section>

        {latest && (
          <div className="card px-3 py-2.5 flex items-center gap-2.5">
            <Avatar name={latest.topWinner.name} size={22} />
            <span className="text-xs text-dim leading-snug">
              {latest.topWinner.name} cashed{" "}
              <span className="num text-yes font-bold">{signed(latest.topWinner.profit)}</span> on{" "}
              {latest.title.length > 34 ? latest.title.slice(0, 34) + "…" : latest.title}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="pill">Live now</span>
          <Link href={`/c/${code}/new`} className="text-xs font-medium text-accent">New bet</Link>
        </div>

        <section className="flex flex-col gap-2.5">
          {data.open.length === 0 && (
            <p className="text-muted text-sm">Nothing running. Call someone out.</p>
          )}

          {data.open.map((b: any) => {
            const takerMult = b.takerSide === "A" ? b.multiplierA : b.multiplierB;
            const takerLabel = b.takerSide === "A" ? b.sideALabel : b.sideBLabel;
            const stance = b.proposerSide === "A" ? b.sideALabel : b.sideBLabel;
            const voting = b.status === "voting";
            const pending = b.status === "pending";

            return (
              <Link key={b.id} href={`/b/${b.id}`} className="card p-3.5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium leading-snug">{b.title}</span>
                  {voting && (
                    <span className="text-[10px] tracking-wide text-accent bg-accent/15 rounded-full px-2.5 py-1.5 whitespace-nowrap">
                      VOTE
                    </span>
                  )}
                  {pending && (
                    <span className="text-[10px] tracking-wide text-gold bg-gold/15 rounded-full px-2.5 py-1.5 whitespace-nowrap">
                      UNTAKEN
                    </span>
                  )}
                </div>

                {/* Who put it up, which way, and how much of it is left. */}
                <div className="flex items-center gap-2">
                  {b.creator && <Avatar name={b.creator} size={20} />}
                  <span className="text-[11px] text-muted leading-snug flex-1">
                    <b className="text-dim">{b.creator}</b> says{" "}
                    <span className={b.proposerSide === "A" ? "text-yes" : "text-no"}>
                      {stance.toLowerCase()}
                    </span>
                    {" · "}
                    <span className="num">{money(b.liability)}</span> up
                    {" · "}
                    {timeLeft(b.deadline)}
                  </span>
                </div>

                {/* One action, because there is only one side to take. */}
                {voting ? (
                  <span className="w-full text-center text-[13px] font-bold text-ink bg-accent rounded-xl py-2.5">
                    Settle it
                  </span>
                ) : (
                  <span
                    className={`w-full text-center text-[13px] font-bold text-ink rounded-xl py-2.5 ${
                      b.takerSide === "A" ? "bg-yes" : "bg-no"
                    }`}
                  >
                    {takerLabel} · {mult(takerMult)}
                  </span>
                )}
              </Link>
            );
          })}
        </section>

        <div className="flex flex-col gap-2 mt-1">
          <span className="pill">Just settled</span>
          {data.recent.slice(0, 4).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate text-dim">{r.title}</span>
              <span className={`whitespace-nowrap ${r.outcome === "A" ? "text-yes" : "text-no"}`}>
                {r.outcome === "A" ? "hit" : "missed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <TabBar code={code} active="live" />
    </main>
  );
}
