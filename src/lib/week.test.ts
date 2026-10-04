import { describe, expect, it } from "vitest";
import { dateKey, startOfWeek, weekDateKeys } from "./week";

describe("dateKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });

  it("pads single-digit month and day", () => {
    expect(dateKey(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("startOfWeek", () => {
  it("returns the same Monday when given a Monday", () => {
    const monday = new Date(2026, 2, 2); // 2026-03-02 is a Monday
    expect(dateKey(startOfWeek(monday))).toBe("2026-03-02");
  });

  it("rolls a Sunday back to the preceding Monday, not forward", () => {
    const sunday = new Date(2026, 2, 8); // 2026-03-08 is a Sunday
    expect(dateKey(startOfWeek(sunday))).toBe("2026-03-02");
  });

  it("rolls a mid-week date back to that week's Monday", () => {
    const wednesday = new Date(2026, 2, 4);
    expect(dateKey(startOfWeek(wednesday))).toBe("2026-03-02");
  });
});

describe("weekDateKeys", () => {
  it("returns 7 consecutive dates starting on Monday and ending on Sunday", () => {
    const wednesday = new Date(2026, 2, 4);
    expect(weekDateKeys(wednesday)).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
  });
});
