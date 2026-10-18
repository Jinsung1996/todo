"use client";

import { useState } from "react";

/** Stat card that opens like a notepad to reveal its list on click. */
export function NotepadCard({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex flex-col rounded-md border border-hairline bg-canvas transition-shadow hover:shadow-elevated">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-2 px-5 py-4 text-left"
      >
        <span className="flex flex-col gap-1">
          <span className="text-sm text-muted">{label}</span>
          <span className="text-2xl font-bold text-ink">{value}</span>
        </span>
        <span
          className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ⌄
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-hairline px-5 py-3">{children}</div>
      )}
    </div>
  );
}
