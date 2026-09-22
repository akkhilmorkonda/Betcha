"use client";

import Link from "next/link";

const ICONS: Record<string, React.ReactNode> = {
  live: <path d="M3 17l5-6 4 4 5-8 4 5" />,
  create: <path d="M12 5v14M5 12h14" />,
  standings: <path d="M6 20V10M12 20V4M18 20v-7" />,
};

function Item({ href, label, icon, active }: { href: string; label: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center gap-1 text-[10px] ${active ? "text-text" : "text-muted"}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
        {ICONS[icon]}
      </svg>
      {label}
    </Link>
  );
}

/**
 * Pinned to the viewport, not parked at the end of the page — otherwise you
 * have to scroll past the whole feed to switch tabs. Pages that use it add
 * bottom padding so their last row isn't hidden underneath.
 *
 * The bar spans the full width but its contents stay inside the same max-w-md
 * column as the page, so it lines up on a desktop window too.
 */
export function TabBar({ code, active }: { code: string; active: "live" | "create" | "standings" }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-panel/95 backdrop-blur"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-md flex pt-3">
        <Item href={`/c/${code}`} label="Live" icon="live" active={active === "live"} />
        <Item href={`/c/${code}/new`} label="Create" icon="create" active={active === "create"} />
        <Item href={`/c/${code}/standings`} label="Standings" icon="standings" active={active === "standings"} />
      </div>
    </nav>
  );
}
