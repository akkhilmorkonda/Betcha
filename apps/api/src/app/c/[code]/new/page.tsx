"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { lineFor, oddsFrom, remainingCapacity, minBackingFor, MIN_LIABILITY, MAX_LIABILITY, DEFAULT_LIABILITY, MIN_STAKE, CENTS } from "@betcha/core";
import { money, mult } from "@betcha/core";
import { CATEGORY_LABEL, type Category } from "@betcha/core";

const CATS: Category[] = ["grades", "sports", "dares"];

export default function NewBetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [circle, setCircle] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [category, setCategory] = useState<Category>("dares");
  const [subjectId, setSubjectId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [liability, setLiability] = useState(DEFAULT_LIABILITY);
  const [mySide, setMySide] = useState<"A" | "B">("B");
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session").then((r) => r.json()).then((d) => setMeId(d.user?.id ?? null));
  }, []);

  useEffect(() => {
    fetch(`/api/circle/${code}`)
      .then((r) => r.json())
      .then((d) => {
        setCircle(d.circle);
        if (d.circle?.members[0]) setSubjectId(d.circle.members[0].userId);
      });
  }, [code]);

  useEffect(() => {
    fetch(`/api/templates?category=${category}`)
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates);
        setTemplateId(d.templates[0]?.id ?? "");
      });
  }, [category]);

  const subject = circle?.members.find((m: any) => m.userId === subjectId);
  const me = circle?.members.find((m: any) => m.userId === meId);
  const myBalance = me?.balance ?? 0;
  const template = templates.find((t) => t.id === templateId);

  // The line is computed with the same pure functions the server uses, so the
  // preview here is the price you actually get.
  const preview = useMemo(() => {
    if (!subject || !template) return null;
    const subjectElo = subject.ratings[category] ?? 1200;
    const p = lineFor(subjectElo, template.difficultyElo);
    const odds = oddsFrom(p);
    return {
      p,
      subjectElo,
      difficultyElo: template.difficultyElo,
      multA: odds.multiplierA,
      multB: odds.multiplierB,
    };
  }, [subject, template, category]);

  // What takers actually get, and therefore the smallest viable backing.
  const takerMult = preview ? (mySide === "A" ? preview.multB : preview.multA) : 2;
  const floor = Math.max(MIN_LIABILITY, minBackingFor(takerMult));
  const covers = remainingCapacity([], mySide === "A" ? "B" : "A", takerMult, Math.max(liability, floor));
  const tooPoor = floor > Math.floor(myBalance);

  // A template already carries the subject's name. Free text usually doesn't —
  // people type "wins dev in a math game" and the feed ends up with a sentence
  // that never says who it's about. Put the name in front unless they wrote it.
  const subjectName = subject?.name ?? "";
  const typed = custom.trim();
  const title = typed
    ? typed.toLowerCase().includes(subjectName.toLowerCase()) || !subjectName
      ? typed
      : `${subjectName} ${typed.charAt(0).toLowerCase()}${typed.slice(1)}`
    : template?.text.replace("{subject}", subjectName) || "";

  async function create() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        circleId: circle.id,
        subjectId,
        category,
        title,
        templateId: custom ? null : templateId,
        liability: Math.max(liability, floor),
        proposerSide: mySide,
        deadline: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    });
    // A 500 returns an HTML error page, not JSON. Without this the parse throws
    // and the button silently does nothing, which is a terrible way to find out
    // something is broken.
    const json = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    setBusy(false);
    if (!res.ok || json.error) {
      return setErr(json.error ?? `Server error (${res.status}) — check the terminal`);
    }
    router.push(`/b/${json.bet.id}`);
  }

  if (!circle) return <div className="p-8 text-muted">Loading…</div>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <Link href={`/c/${code}`} className="pill hover:text-white">← {circle.name}</Link>
      <h1 className="text-xl font-semibold">New bet</h1>

      <div className="card p-4 space-y-4">
        <div className="space-y-2">
          <p className="pill">Category</p>
          <div className="flex gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  category === c ? "bg-accent text-ink border-accent font-semibold" : "border-edge text-muted"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="pill">Who's on the hook</p>
          <div className="flex flex-wrap gap-2">
            {circle.members.map((m: any) => (
              <button
                key={m.userId}
                onClick={() => setSubjectId(m.userId)}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  subjectId === m.userId ? "bg-accent text-ink border-accent font-semibold" : "border-edge text-muted"
                }`}
              >
                {m.name}
                <span className="num ml-2 opacity-70">{Math.round(m.ratings[category] ?? 1200)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="pill">Challenge</p>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.text.replace("{subject}", subject?.name ?? "")} · {Math.round(t.difficultyElo)}
              </option>
            ))}
          </select>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="…or write your own"
            className="w-full bg-ink border border-edge rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <span className="pill">Your call</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMySide("A")}
            className={`py-3 rounded-xl text-sm font-medium border transition ${
              mySide === "A" ? "bg-yes text-ink border-yes" : "border-edge text-muted"
            }`}
          >
            {subject?.name ?? "They"}&#39;ll do it
          </button>
          <button
            onClick={() => setMySide("B")}
            className={`py-3 rounded-xl text-sm font-medium border transition ${
              mySide === "B" ? "bg-no text-ink border-no" : "border-edge text-muted"
            }`}
          >
            No chance
          </button>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          You&#39;re taking this side yourself. Everyone else can only take the other
          one, and the bet isn&#39;t live until somebody does.
        </p>
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="pill">Most you&#39;ll lose</span>
          <span className="num text-xl font-bold">{money(liability)}</span>
        </div>
        <input
          type="range"
          min={floor}
          max={Math.max(floor, Math.min(MAX_LIABILITY, Math.floor(myBalance)))}
          step={CENTS}
          value={Math.max(liability, floor)}
          onChange={(e) => setLiability(Number(e.target.value))}
          className="w-full accent-accent"
          aria-label="What you're putting up"
        />
        {covers < MIN_STAKE && (
          <p className="text-xs text-no leading-relaxed">
            At {mult(takerMult)} this only covers {money(covers)} of bets — under the{" "}
            {money(MIN_STAKE)} minimum, so nobody could take it. Put up at least{" "}
            {money(floor)}.
          </p>
        )}
        {floor > MIN_LIABILITY && covers >= MIN_STAKE && (
          <p className="text-[11px] text-muted">
            {mult(takerMult)} is a long price, so {money(floor)} is the least that
            makes this bet takeable.
          </p>
        )}
        <p className="text-xs text-muted leading-relaxed">
          {money(liability)} comes out of your {money(myBalance)} now and comes back
          when it settles, plus whatever you win, minus whatever you lose. You can
          never lose more than this.
        </p>
      </div>

      {preview && (
        <div className="card p-4 space-y-2">
          <p className="pill">Opening line</p>
          <p className="text-sm">
            <span className="num">{Math.round(preview.subjectElo)}</span> vs{" "}
            <span className="num">{Math.round(preview.difficultyElo)}</span> →{" "}
            <span className="num text-yes">{Math.round(preview.p * 100)}%</span>
          </p>
          <p className="text-sm num text-muted">
            {preview.multA.toFixed(2)}x if they do it · {preview.multB.toFixed(2)}x if they don't
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Whoever takes you on gets{" "}
            <span className="num text-text">
              {(mySide === "A" ? preview.multB : preview.multA).toFixed(2)}x
            </span>
            , and at {money(liability)} you can cover up to{" "}
            <span className="num text-text">
              {money(Math.floor(remainingCapacity([], mySide === "A" ? "B" : "A",
                mySide === "A" ? preview.multB : preview.multA, liability)))}
            </span>{" "}
            of them.
          </p>
        </div>
      )}

      <button
        disabled={busy || !title || tooPoor}
        onClick={create}
        className="w-full py-3 rounded-lg bg-yes text-ink font-semibold disabled:opacity-50"
      >
        {busy ? "Putting it up…" : `Put up ${money(liability)} on this`}
      </button>
      {tooPoor && (
        <p className="text-sm text-no">
          You&#39;d need {money(floor)} to back this at {mult(takerMult)} and you have{" "}
          {money(myBalance)}. Pick an easier challenge or the other side.
        </p>
      )}
      {err && <p className="text-sm text-no">{err}</p>}
    </main>
  );
}
