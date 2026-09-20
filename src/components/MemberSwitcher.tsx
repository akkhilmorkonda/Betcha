"use client";

import { useState } from "react";
import { Avatar } from "./Avatar";

/** Demo affordance: become any member instantly, no login. */
export function MemberSwitcher({
  members,
  currentId,
  onSwitch,
}: {
  members: { userId: string; name: string }[];
  currentId: string | null;
  onSwitch: () => void;
}) {
  const [open, setOpen] = useState(false);
  const me = members.find((m) => m.userId === currentId);

  async function pick(userId: string) {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setOpen(false);
    onSwitch();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm"
        aria-label="Switch member"
      >
        <Avatar name={me?.name ?? "?"} size={30} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-10 card p-1.5 flex flex-col gap-0.5 min-w-[150px]">
          {members.map((m) => (
            <button
              key={m.userId}
              onClick={() => pick(m.userId)}
              className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left ${
                m.userId === currentId ? "bg-accent/15 text-accent" : "hover:bg-edge/60"
              }`}
            >
              <Avatar name={m.name} size={22} />
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
