"use client";

export function OddsBar({
  probA,
  multiplierA,
  multiplierB,
  labelA,
  labelB,
  openingProbA,
}: {
  probA: number;
  multiplierA: number;
  multiplierB: number;
  labelA: string;
  labelB: string;
  openingProbA?: number;
}) {
  const pct = Math.round(probA * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-yes font-medium">
          {labelA} <span className="num text-muted">{multiplierA.toFixed(2)}x</span>
        </span>
        <span className="text-no font-medium">
          <span className="num text-muted">{multiplierB.toFixed(2)}x</span> {labelB}
        </span>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden bg-no/30">
        <div
          className="absolute inset-y-0 left-0 bg-yes transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        {openingProbA !== undefined && (
          <div
            className="absolute inset-y-0 w-px bg-white/70"
            style={{ left: `${openingProbA * 100}%` }}
            title={`Opening line ${Math.round(openingProbA * 100)}%`}
          />
        )}
      </div>

      <div className="flex justify-between text-xs num text-muted">
        <span>{pct}%</span>
        {openingProbA !== undefined && Math.abs(openingProbA - probA) > 0.005 && (
          <span className="text-accent">
            opened {Math.round(openingProbA * 100)}% · rating moved
          </span>
        )}
        <span>{100 - pct}%</span>
      </div>
    </div>
  );
}
