"use client";

import { use, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { TabBar } from "@/components/TabBar";
import { money, signed } from "@betcha/core";
import { CATEGORY_LABEL, type Category } from "@betcha/core";

type Board = "money" | "sharpest" | "form";
const CATS: Category[] = ["dares", "grades", "sports"];

const BLURB: Record<Board, string> = {
  money: "What everyone is actually up or down. Settle it however you like — coffee, dinner, bragging rights.",
  sharpest:
    "Who reads the room best. Backing a long shot that lands counts for more than backing a sure thing, and betting big on a bad call costs double — so this board can't be farmed by betting more, only by being right when it was hard.",
  form: "How good people actually are at the thing. Separate talent from calling it right.",
};

export default function StandingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [data, setData] = useState<any>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>("money");
  const [cat, setCat] = useState<Category>("dares");

  useEffect(() => {
    Promise.all([
      fetch(`/api/circle/${code}`).then((r) => r.json()),
      fetch("/api/session").then((r) => r.json()),
    ]).then(([c, s]) => {
      setData(c.circle ?? null);
      setMeId(s.user?.id ?? null);
    });
  }, [code]);

  if (!data) return <div className="p-8 text-muted">Loading…</div>;

  const rows = [...data.members].sort((a: any, b: any) =>
    board === "money"
      ? b.balance - a.balance
      : board === "sharpest"
        ? b.forecastElo - a.forecastElo
        : (b.ratings[cat] ?? 1200) - (a.ratings[cat] ?? 1200)
  );

  return (
    <main className="mx-auto max-w-md min-h-screen flex flex-col">
      <div className="flex-1 px-5 pt-5 pb-28 flex flex-col gap-4">
        <h1 className="text-lg font-bold tracking-tight">Standings</h1>

        <div className="flex gap-1 bg-surface rounded-xl p-1">
          {(["money", "sharpest", "form"] as Board[]).map((b) => (
            <button
              key={b}
              onClick={() => setBoard(b)}
              className={`flex-1 text-[13px] rounded-[9px] py-2 capitalize ${
                board === b ? "bg-text text-ink font-medium" : "text-muted"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {board === "form" && (
          <div className="flex gap-1.5">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cat === c ? "chipOn" : "chip"}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted leading-relaxed">{BLURB[board]}</p>

        <div className="flex flex-col">
          {rows.map((m: any, i: number) => {
            const me = m.userId === meId;
            const rec = m.record?.[cat] ?? { wins: 0, losses: 0 };
            const never = board === "form" && rec.wins === 0 && rec.losses > 0;
            return (
              <div
                key={m.userId}
                className={`flex items-center gap-3 py-3.5 ${
                  i === rows.length - 1 ? "" : "border-b border-edge/60"
                } ${me ? "bg-accent/[0.07] rounded-xl px-2.5" : ""}`}
              >
                <Avatar name={m.name} size={32} />

                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${me ? "font-bold" : "font-medium"}`}>{m.name}</span>
                    {board === "sharpest" && i === 0 && (
                      <span className="text-[9px] tracking-wide font-bold text-ink bg-gold rounded-full px-1.5 py-0.5">
                        SHARPEST
                      </span>
                    )}
                    {me && <span className="text-[11px] text-muted">you</span>}
                  </div>
                  <span className="text-[11px] text-muted">
                    {board === "money" && `${m.weeklyChange >= 0 ? "up" : "down"} ${money(Math.abs(m.weeklyChange))} this week`}
                    {board === "sharpest" && `${m.forecastBets} calls made`}
                    {board === "form" && (never ? "never managed one" : `${rec.wins}-${rec.losses}`)}
                  </span>
                </div>

                <div className="flex flex-col items-end gap-0.5">
                  <span className="num text-[17px] font-bold">
                    {board === "money" && money(m.balance)}
                    {board === "sharpest" && Math.round(m.forecastElo)}
                    {board === "form" && Math.round(m.ratings[cat] ?? 1200)}
                  </span>
                  {board === "money" && (
                    <span className={`num text-[11px] ${m.weeklyChange >= 0 ? "text-yes" : "text-no"}`}>
                      {signed(m.weeklyChange)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TabBar code={code} active="standings" />
    </main>
  );
}
