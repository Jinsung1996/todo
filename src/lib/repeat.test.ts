import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  describeRepeat,
  EVERY_DAY,
  isWeekdayList,
  repeatDates,
  weekdayOfKey,
  WEEKDAYS,
} from "./repeat";

describe("date key arithmetic", () => {
  it("crosses month and year ends", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("knows the weekday", () => {
    expect(weekdayOfKey("2026-10-20")).toBe(2); // 화
    expect(weekdayOfKey("2026-10-25")).toBe(0); // 일
  });
});

describe("repeatDates", () => {
  it("lists only the chosen weekdays, inclusive of both ends", () => {
    // 2026-10-19 is a Monday.
    expect(repeatDates(WEEKDAYS, "2026-10-19", "2026-10-26")).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-26",
    ]);
    expect(repeatDates(EVERY_DAY, "2026-10-19", "2026-10-25")).toHaveLength(7);
    expect(repeatDates([6], "2026-10-19", "2026-11-01")).toEqual(["2026-10-24", "2026-10-31"]);
    expect(repeatDates(EVERY_DAY, "2026-10-20", "2026-10-19")).toEqual([]);
  });
});

describe("isWeekdayList", () => {
  it("accepts 1–7 distinct days 0–6 only", () => {
    expect(isWeekdayList([1, 3, 5])).toBe(true);
    expect(isWeekdayList([])).toBe(false);
    expect(isWeekdayList([1, 1])).toBe(false);
    expect(isWeekdayList([7])).toBe(false);
    expect(isWeekdayList([1.5])).toBe(false);
    expect(isWeekdayList("1,2")).toBe(false);
  });
});

describe("describeRepeat", () => {
  it("names the presets and lists custom days in 월..일 order", () => {
    expect(describeRepeat({ startTime: "07:00", weekdays: EVERY_DAY })).toBe("매일 07:00");
    expect(describeRepeat({ startTime: "09:00", weekdays: [5, 4, 3, 2, 1] })).toBe("주중 09:00");
    expect(describeRepeat({ startTime: "18:30", weekdays: [0, 1, 3] })).toBe("월·수·일 18:30");
  });
});
