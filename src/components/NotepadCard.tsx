"use client";

import { useState } from "react";

/** Compact stat pill that opens like a notepad to reveal its list on click. */
export function NotepadCard({
  label,
  value,
  children,
}: {
  label: string;
  value: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col rounded-md border border-hairline bg-canvas transition-shadow hover:shadow-elevated">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="truncate text-xs text-muted">{label}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-base font-bold text-ink">{value}</span>
          <span
            className={`text-[10px] text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            ⌄
          </span>
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-t border-hairline px-3 py-2">{children}</div>
      )}
    </div>
  );
}
