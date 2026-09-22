"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EvidenceCapture } from "@/components/EvidenceCapture";
import { money, signed, mult, timeLeft } from "@/lib/format";
import { CENTS, MIN_STAKE } from "@/lib/market";
import { CATEGORY_LABEL, type Category } from "@/lib/categories";

export default function BetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bet, setBet] = useState<any>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"A" | "B" | null>(null);
  // Cents, like everything else. money() is what turns it into "$10".
  const [amount, setAmount] = useState(10 * CENTS);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [spark, setSpark] = useState<any>(null);
  const [why, setWhy] = useState(false);

  const load = useCallback(async () => {
    const [b, s] = await Promise.all([
      fetch(`/api/bets/${id}`).then((r) => r.json()),
      fetch("/api/session").then((r) => r.json()),
    ]);
    setBet(b.bet ?? null);
    setMeId(s.user?.id ?? null);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  if (!bet) return <div className="p-8 text-muted">Loading…</div>;

  const mine = bet.positions.find((p: any) => p.userId === meId);
  const capacityFor = (side: "A" | "B") => Math.floor(side === "A" ? bet.capacityA : bet.capacityB);
  const open = bet.status === "open";
  const voting = bet.status === "voting";
  const resolved = bet.status === "resolved";
  const canVote = voting && meId && bet.eligibleVoters.includes(meId);

  const takerSide: "A" | "B" = bet.takerSide ?? "A";
  const takerLabel = takerSide === "A" ? bet.sideALabel : bet.sideBLabel;
  const proposerLabel = bet.proposerSide === "A" ? bet.sideALabel : bet.sideBLabel;
  const pending = bet.status === "pending";
  const capacity = Math.floor(sheet === "A" ? bet.capacityA : bet.capacityB);
  const maxStake = Math.max(1, Math.min(50, capacity));
  const m = sheet === "A" ? bet.multiplierA : bet.multiplierB;

  async function post(url: string, body: any) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Same guard as the create screen: a 500 is HTML, not JSON.
    const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    setBusy(false);
    if (!res.ok || json.error) setMsg(json.error ?? `Server error (${res.status}) — check the terminal`);
    else setSheet(null);
    await load();
    return json;
  }

  const votes = bet.resolution?.votes ?? [];
  const tallyA = votes.filter((v: any) => v.side === "A").length;
  const tallyB = votes.filter((v: any) => v.side === "B").length;
  const record = bet.subjectRecord;
  const never = record && record.wins === 0 && record.losses > 0;

  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col">
      <div className="flex-1 px-5 pt-5 flex flex-col gap-4">

        <Link href={`/c/${bet.circleCode}`} className="flex items-center gap-1.5 text-[13px] text-muted">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Back
        </Link>

        <div className="flex flex-col gap-1.5">
          <span className="pill">
            {CATEGORY_LABEL[bet.category as Category]} · {timeLeft(bet.deadline)}
          </span>
          <h1 className="text-xl font-bold leading-snug tracking-tight">{bet.title}</h1>
        </div>

        {!resolved && (
          <div className="flex gap-2.5">
            {(["A", "B"] as const).map((s) => {
              const isA = s === "A";
              const takeable = s === takerSide;
              return (
                <div
                  key={s}
                  className={`flex-1 flex flex-col items-center gap-1 rounded-2xl py-4 ${
                    isA ? "bg-yes/10" : "bg-no/10"
                  } ${takeable ? "" : "opacity-35"}`}
                >
                  <span className={`num text-[28px] font-bold leading-none ${isA ? "text-yes" : "text-no"}`}>
                    {mult(isA ? bet.multiplierA : bet.multiplierB)}
                  </span>
                  <span className="text-[11px] text-muted num">
                    {money(10)} pays {money(10 * (isA ? bet.multiplierA : bet.multiplierB))}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!resolved && (
          <div className="card p-3.5 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Avatar name={bet.creator?.name ?? "?"} size={28} />
              <span className="text-sm flex-1">
                <b>{bet.creator?.name}</b> says{" "}
                <span className={bet.proposerSide === "A" ? "text-yes" : "text-no"}>
                  {proposerLabel.toLowerCase()}
                </span>
              </span>
              <span className="num text-sm font-bold">{money(bet.liability)}</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              {pending
                ? `Nobody has taken them on yet. Their ${money(bet.liability)} is set aside and nothing is at stake until someone does.`
                : `They're covering ${money(bet.liability)} of anyone who disagrees. ${money(Math.max(0, capacityFor(takerSide)))} of it is still open.`}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <span className="pill">{pending ? "Waiting on a taker" : "Who's in"}</span>
          {bet.positions.length === 0 && (
            <p className="text-sm text-muted">
              Nobody yet. Take {bet.creator?.name} on and the bet goes live.
            </p>
          )}

          {bet.positions.map((p: any) => (
            <div key={p.id} className="flex items-center gap-3">
              <Avatar name={p.name} size={32} />
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{p.name}</span>
                  {p.userId === bet.sharpestUserId && (
                    <span className="text-[9px] tracking-wide font-bold text-ink bg-gold rounded-full px-1.5 py-0.5">
                      SHARPEST
                    </span>
                  )}
                </div>
                <span className="num text-[11px] text-muted">
                  {money(p.amount)} at {mult(p.multiplierAtEntry)}
                </span>
              </div>
              {resolved ? (
                <span className={`num text-sm font-bold ${p.payout > 0 ? "text-yes" : "text-muted"}`}>
                  {signed(p.payout > 0 ? p.payout - p.amount : -p.amount)}
                </span>
              ) : (
                <span className={`num text-[13px] font-bold ${p.side === "A" ? "text-yes" : "text-no"}`}>
                  {p.side === "A" ? "Yes" : "No"}
                </span>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 opacity-55">
            <Avatar name={bet.subject.name} size={32} />
            <span className="flex-1 text-sm">{bet.subject.name}</span>
            <span className="text-[11px] text-muted">it's about them</span>
          </div>
        </div>

        {!resolved && (
          <div className="card p-3.5">
            <button
              onClick={() => setWhy((v) => !v)}
              className="text-[13px] text-muted w-full text-left"
            >
              Why {mult(bet.multiplierA)}?
            </button>
            {why && (
              <div className="flex flex-col gap-2 mt-3">
                <p className="text-[13px] text-dim leading-relaxed">
                  {bet.subject.name}{" "}
                  {never ? (
                    <span className="text-text">has never once pulled this off</span>
                  ) : (
                    <>is <span className="text-text">{record?.wins}-{record?.losses}</span></>
                  )}{" "}
                  in {CATEGORY_LABEL[bet.category as Category].toLowerCase()}
                  {bet.template?.timesUsed ? `, and this one has run ${bet.template.timesUsed} times before` : ""}.
                  The price follows the track record, so it stays at {mult(bet.multiplierA)} however much anyone bets.
                </p>
                <p className="text-[11px] text-muted">
                  Moves when they win or lose one of these — not when money moves.
                </p>
              </div>
            )}
          </div>
        )}

        {open && (
          <div className="card p-3.5 flex flex-col gap-3">
            <span className="pill">Settle it</span>
            <EvidenceCapture
              busy={busy}
              onSubmit={async (imageDataUrl) => {
                const r = await post(`/api/bets/${id}/evidence`, { imageDataUrl });
                if (r?.evidence) setSpark(r.evidence);
              }}
            />
            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-edge" />
              <span className="text-[11px] text-muted">or</span>
              <span className="h-px flex-1 bg-edge" />
            </div>

            {/* Plenty of bets can't be photographed — "did he actually stop
                texting her", "was that a fair game". The vote is a real first
                option, not a fallback for when the camera fails. */}
            <button
              disabled={busy}
              onClick={() => post(`/api/bets/${id}/evidence`, { imageDataUrl: "" })}
              className="w-full py-3 rounded-xl border border-edge2 text-sm font-medium hover:border-muted disabled:opacity-50"
            >
              Can't photograph this — put it to the circle
            </button>
          </div>
        )}

        {spark && (
          <div className="card p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="pill">Muse Spark</span>
              {/* The verdict is the whole story. The model's confidence float is
                  deliberately not shown: a real response came back at 0.99
                  confident and "unclear", and putting those side by side reads
                  as a contradiction rather than as caution. */}
              <span
                className={`text-[9px] tracking-wide font-bold rounded-full px-2 py-1 uppercase ${
                  spark.verdict === "clearly_true"
                    ? "bg-yes text-ink"
                    : spark.verdict === "clearly_false"
                      ? "bg-no text-ink"
                      : "bg-gold text-ink"
                }`}
              >
                {spark.verdict.replace(/_/g, " ")}
              </span>
            </div>

            {spark.claim && <p className="text-sm leading-relaxed">{spark.claim}</p>}

            {spark.observations?.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="pill">What it saw</span>
                <ul className="text-[13px] text-dim flex flex-col gap-1.5">
                  {spark.observations.map((o: string, i: number) => (
                    <li key={i} className="leading-snug">— {o}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[11px] text-accent">{spark.reason}</p>
          </div>
        )}

        {voting && (
          <div className="card p-3.5 flex flex-col gap-3">
            <span className="pill">Circle vote</span>
            <p className="text-sm text-muted leading-relaxed">
              {bet.eligibleVoters.length} can vote. Anyone with money on it is out —
              including whoever put this bet up, and {bet.subject.name}.
            </p>
            <div className="flex gap-4 num text-sm">
              <span className="text-yes">{bet.sideALabel} {tallyA}</span>
              <span className="text-no">{bet.sideBLabel} {tallyB}</span>
            </div>
            {canVote ? (
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  disabled={busy}
                  onClick={() => post(`/api/bets/${id}/vote`, { side: "A" })}
                  className="py-3 rounded-xl bg-yes text-ink font-bold text-sm"
                >
                  {bet.sideALabel}
                </button>
                <button
                  disabled={busy}
                  onClick={() => post(`/api/bets/${id}/vote`, { side: "B" })}
                  className="py-3 rounded-xl bg-no text-ink font-bold text-sm"
                >
                  {bet.sideBLabel}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                You've got a stake in this — switch member to vote.
              </p>
            )}
          </div>
        )}

        {resolved && (
          <div className="card p-4 flex flex-col gap-3">
            <span className="pill">Settled by {bet.resolution?.method}</span>
            <p className={`text-xl font-bold ${bet.resolution?.finalOutcome === "A" ? "text-yes" : "text-no"}`}>
              {bet.resolution?.finalOutcome === "A" ? bet.sideALabel : bet.sideBLabel}
            </p>
            {bet.resolution?.sparkClaim && (
              <p className="text-sm text-muted leading-relaxed">{bet.resolution.sparkClaim}</p>
            )}
            {bet.eloEvents?.length > 0 && (
              <div className="pt-3 border-t border-edge flex flex-col gap-2">
                <span className="pill">What this changes</span>
                {bet.eloEvents.map((e: any) => (
                  <div key={e.id} className="flex justify-between num text-[13px]">
                    <span className="text-muted">
                      {e.userId === bet.subjectId ? bet.subject.name : e.templateId ? "the challenge" : "opponent"}
                    </span>
                    <span className={e.after > e.before ? "text-yes" : "text-no"}>
                      {Math.round(e.before)} → {Math.round(e.after)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {msg && <p className="text-sm text-no">{msg}</p>}
      </div>

      {(open || pending) && !mine && !sheet && meId !== bet.creatorId && (
        <div className="sticky bottom-0 px-5 pt-3 pb-6 border-t border-edge bg-panel flex flex-col gap-1.5">
          <button
            onClick={() => {
              setAmount(Math.max(1, Math.min(10, capacityFor(takerSide))));
              setSheet(takerSide);
            }}
            className={`w-full py-3.5 rounded-2xl font-bold text-[15px] text-ink ${
              takerSide === "A" ? "bg-yes" : "bg-no"
            }`}
          >
            Take {bet.creator?.name} on — {takerLabel.toLowerCase()}
          </button>
          <span className="text-[11px] text-muted text-center">
            {money(capacityFor(takerSide))} available at {mult(takerSide === "A" ? bet.multiplierA : bet.multiplierB)}
          </span>
        </div>
      )}

      {(open || pending) && meId === bet.creatorId && !resolved && (
        <div className="sticky bottom-0 px-5 pt-3 pb-6 border-t border-edge bg-panel text-sm text-center text-muted">
          You put this up — {money(bet.liability)} riding on{" "}
          <b className={bet.proposerSide === "A" ? "text-yes" : "text-no"}>{proposerLabel.toLowerCase()}</b>
        </div>
      )}

      {mine && !resolved && (
        <div className="sticky bottom-0 px-5 pt-3 pb-6 border-t border-edge bg-panel text-sm text-center text-muted">
          You're on <b className={mine.side === "A" ? "text-yes" : "text-no"}>
            {mine.side === "A" ? bet.sideALabel : bet.sideBLabel}
          </b> for <span className="num">{money(mine.amount)}</span> at{" "}
          <span className="num">{mult(mine.multiplierAtEntry)}</span>
        </div>
      )}

      {sheet && (
        <div className="fixed inset-0 z-20 flex flex-col justify-end bg-ink/70" onClick={() => setSheet(null)}>
          <div
            className="bg-surface border-t border-edge2 rounded-t-3xl px-5 pt-3 pb-7 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-edge2 self-center" />

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className={`text-[15px] font-bold ${sheet === "A" ? "text-yes" : "text-no"}`}>
                  {sheet === "A" ? bet.sideALabel : bet.sideBLabel}
                </span>
                <span className="text-xs text-muted">Price locks when you confirm</span>
              </div>
              <span className={`num text-xl font-bold ${sheet === "A" ? "text-yes" : "text-no"}`}>
                {mult(m)}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="num text-[52px] font-bold leading-none tracking-tight">{money(amount)}</span>
              <span className="text-xs text-muted">stake</span>
            </div>

            <input
              type="range"
              min={MIN_STAKE}
              max={maxStake}
              step={CENTS}
              value={Math.min(amount, maxStake)}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Stake"
            />

            <div className="bg-panel border border-edge rounded-2xl p-3.5 flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-muted">Returns if it hits</span>
                <span className="num font-bold text-yes">{money(amount * m)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Profit</span>
                <span className="num">{signed(amount * (m - 1))}</span>
              </div>
              {capacity < 50 * CENTS && (
                <div className="flex justify-between">
                  <span className="text-muted">Left on this side</span>
                  <span className="num">{money(capacity)}</span>
                </div>
              )}
            </div>

            <button
              disabled={busy || !meId}
              onClick={() => post(`/api/bets/${id}/position`, { side: sheet, amount })}
              className={`py-4 rounded-2xl font-bold text-[15px] text-ink disabled:opacity-50 ${
                sheet === "A" ? "bg-yes" : "bg-no"
              }`}
            >
              Confirm {money(amount)}
            </button>
            {msg && <p className="text-sm text-no text-center">{msg}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
