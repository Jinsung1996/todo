import { describe, expect, it } from "vitest";
import {
  DAY_START_MINUTES,
  minutesToTime,
  nextAvailableSlot,
  snapMinutes,
  timeToMinutes,
} from "./schedule";

describe("timeToMinutes / minutesToTime", () => {
  it("round-trips HH:mm through minutes", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
  });

  it("pads single-digit hours and minutes", () => {
    expect(minutesToTime(65)).toBe("01:05");
  });
});

describe("snapMinutes", () => {
  it("rounds to the nearest 30-minute step by default", () => {
    expect(snapMinutes(10 * 60 + 40)).toBe(10 * 60 + 30);
    expect(snapMinutes(10 * 60 + 46)).toBe(11 * 60);
  });
});

describe("nextAvailableSlot", () => {
  it("places the first todo of the day at the grid start", () => {
    expect(nextAvailableSlot([], 60)).toBe(minutesToTime(DAY_START_MINUTES));
  });

  it("skips past an existing block to find the next free slot", () => {
    const slot = nextAvailableSlot([{ startTime: "07:00", durationMinutes: 60 }], 60);
    expect(slot).toBe("08:00");
  });

  it("fits a shorter todo into a gap between two existing blocks", () => {
    const existing = [
      { startTime: "07:00", durationMinutes: 60 }, // 07:00-08:00
      { startTime: "08:30", durationMinutes: 60 }, // 08:30-09:30
    ];
    expect(nextAvailableSlot(existing, 30)).toBe("08:00");
  });

  it("stacks after the last block once the rest of the day is fully booked", () => {
    // A single block spanning 07:00-24:00 leaves no gap for a new 60-minute
    // todo from the day's start onward, so it lands right after that block.
    const existing = [{ startTime: "07:00", durationMinutes: 17 * 60 }];
    expect(nextAvailableSlot(existing, 60)).toBe("00:00");
  });
});
