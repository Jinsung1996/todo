"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 15_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(id);
}

/**
 * The current time, whole minutes since the epoch, so the calendar's
 * "now" line moves down every minute; null during SSR.
 */
export function useNowMinute(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 60_000),
    () => null
  );
}
