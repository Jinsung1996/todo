// Categories are free text (each person organizes 일간 목표 differently —
// "공부"/"회사"/"여가" was just one example), so there's no fixed enum to
// pick a color from. Instead, any non-empty category string gets a stable
// color by hashing it into a fixed palette: same text always comes back the
// same color, no picker or per-category color storage required.

export const CATEGORY_SUGGESTIONS = ["공부", "회사", "여가", "운동"];
export const CATEGORY_MAX_LENGTH = 20;

export type CategoryInputResult =
  | { ok: true; category: string | null | undefined }
  | { ok: false; error: string };

/**
 * Shared request-body validation for the `category` field — used by every
 * route that creates or patches a todo, so "non-empty, <= max length,
 * trimmed, null clears it" stays consistent in one place.
 */
export function normalizeCategoryInput(value: unknown): CategoryInputResult {
  if (value === undefined) return { ok: true, category: undefined };
  if (value === null) return { ok: true, category: null };
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: "category must be a non-empty string or null" };
  }
  if (value.length > CATEGORY_MAX_LENGTH) {
    return { ok: false, error: `category must be at most ${CATEGORY_MAX_LENGTH} characters` };
  }
  return { ok: true, category: value.trim() };
}

interface CategoryStyle {
  /** Left accent border color (the block/calendar event's main color cue). */
  accent: string;
  /** Light background tint matching the accent. */
  bg: string;
  /** Small solid dot, for compact spots like tray chips. */
  dot: string;
}

const NEUTRAL_STYLE: CategoryStyle = {
  accent: "border-l-hairline",
  bg: "bg-canvas",
  dot: "bg-muted-soft",
};

// Avoids emerald/red — this app already uses emerald for "완료" and red/rose
// for the primary accent color, so reusing them here would blur those
// meanings together.
const PALETTE: CategoryStyle[] = [
  {
    accent: "border-l-blue-400 dark:border-l-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    dot: "bg-blue-500",
  },
  {
    accent: "border-l-amber-400 dark:border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    dot: "bg-amber-500",
  },
  {
    accent: "border-l-violet-400 dark:border-l-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    dot: "bg-violet-500",
  },
  {
    accent: "border-l-teal-400 dark:border-l-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    dot: "bg-teal-500",
  },
  {
    accent: "border-l-fuchsia-400 dark:border-l-fuchsia-500",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    dot: "bg-fuchsia-500",
  },
  {
    accent: "border-l-indigo-400 dark:border-l-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    dot: "bg-indigo-500",
  },
  {
    accent: "border-l-orange-400 dark:border-l-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    dot: "bg-orange-500",
  },
  {
    accent: "border-l-cyan-400 dark:border-l-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-950/30",
    dot: "bg-cyan-500",
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Neutral style for an unset/empty category; otherwise a stable hashed color. */
export function categoryStyle(category: string | null | undefined): CategoryStyle {
  const trimmed = category?.trim();
  if (!trimmed) return NEUTRAL_STYLE;
  return PALETTE[hashString(trimmed) % PALETTE.length];
}
