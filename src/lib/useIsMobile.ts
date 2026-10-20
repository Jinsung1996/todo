"use client";

import { useSyncExternalStore } from "react";

// Below Tailwind's `md` breakpoint the dashboard swaps the week/month
// calendar for the one-day phone view (src/components/MobileDay.tsx).
const QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Whether the screen is phone-sized; always false during SSR. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
