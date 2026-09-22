import { initial, tintFor } from "@betcha/core";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      className="av"
      style={{
        width: size,
        height: size,
        background: tintFor(name),
        fontSize: Math.round(size * 0.34),
      }}
      aria-hidden="true"
    >
      {initial(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  size = 18,
  max = 4,
  ring = "#0B0D12",
}: {
  names: string[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="flex">
      {shown.map((n, i) => (
        <span
          key={n + i}
          className="av"
          style={{
            width: size,
            height: size,
            background: tintFor(n),
            fontSize: Math.round(size * 0.42),
            border: `2px solid ${ring}`,
            marginLeft: i === 0 ? 0 : -Math.round(size * 0.32),
          }}
          aria-hidden="true"
        >
          {initial(n)}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="av text-muted"
          style={{
            width: size,
            height: size,
            background: "#1B2029",
            fontSize: Math.round(size * 0.38),
            border: `2px solid ${ring}`,
            marginLeft: -Math.round(size * 0.32),
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
