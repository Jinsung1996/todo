import { describe, expect, it } from "vitest";
import { dateKey } from "@/lib/week";
import { effectiveStatus, isActiveToday, isDoneToday } from "./recurring";

const today = dateKey();
const yesterday = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

describe("isDoneToday", () => {
  it("follows the raw status for a non-recurring todo", () => {
    expect(isDoneToday({ status: "DONE", isRecurring: false })).toBe(true);
    expect(isDoneToday({ status: "TODO", isRecurring: false })).toBe(false);
  });

  it("is true for a recurring todo only when last completed today", () => {
    expect(isDoneToday({ status: "TODO", isRecurring: true, lastCompletedDate: today })).toBe(true);
    expect(isDoneToday({ status: "TODO", isRecurring: true, lastCompletedDate: yesterday })).toBe(
      false
    );
    expect(isDoneToday({ status: "TODO", isRecurring: true, lastCompletedDate: null })).toBe(false);
  });

  it("ignores a stale DONE status on a recurring todo from a previous day", () => {
    // Even if status were ever left as DONE, a recurring todo only counts
    // as done when *today's* completion marker matches.
    expect(isDoneToday({ status: "DONE", isRecurring: true, lastCompletedDate: yesterday })).toBe(
      false
    );
  });
});

describe("effectiveStatus", () => {
  it("passes through the real status for a non-recurring todo", () => {
    expect(effectiveStatus({ status: "DOING", isRecurring: false })).toBe("DOING");
  });

  it("shows DONE/TODO for a recurring todo based on today's completion only", () => {
    expect(effectiveStatus({ status: "TODO", isRecurring: true, lastCompletedDate: today })).toBe(
      "DONE"
    );
    expect(
      effectiveStatus({ status: "TODO", isRecurring: true, lastCompletedDate: yesterday })
    ).toBe("TODO");
  });
});

describe("isActiveToday", () => {
  it("requires both scheduledDate and startTime to count as placed", () => {
    expect(isActiveToday({ scheduledDate: null, startTime: null, isRecurring: false })).toBe(false);
    expect(isActiveToday({ scheduledDate: today, startTime: null, isRecurring: false })).toBe(false);
  });

  it("matches only today's literal scheduledDate for a non-recurring todo", () => {
    expect(isActiveToday({ scheduledDate: today, startTime: "09:00", isRecurring: false })).toBe(
      true
    );
    expect(
      isActiveToday({ scheduledDate: yesterday, startTime: "09:00", isRecurring: false })
    ).toBe(false);
  });

  it("never carries a recurring template over onto today on its own", () => {
    expect(
      isActiveToday({ scheduledDate: yesterday, startTime: "09:00", isRecurring: true })
    ).toBe(false);
    expect(isActiveToday({ scheduledDate: today, startTime: "09:00", isRecurring: true })).toBe(
      false
    );
  });
});
