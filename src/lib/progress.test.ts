import { describe, expect, it } from "vitest";
import { dailyProgress, todosOnDay, weeklyProgress } from "./progress";

describe("weeklyProgress", () => {
  it("returns 0 for an empty todo list", () => {
    expect(weeklyProgress([])).toBe(0);
  });

  it("returns a partial percentage when some todos are done", () => {
    expect(
      weeklyProgress([
        { status: "DONE" },
        { status: "DOING" },
        { status: "TODO" },
        { status: "DONE" },
      ])
    ).toBe(50);
  });

  it("returns 100 when all todos are done", () => {
    expect(
      weeklyProgress([{ status: "DONE" }, { status: "DONE" }])
    ).toBe(100);
  });

  it("leaves out repeat copies still ahead of today", () => {
    expect(
      weeklyProgress(
        [
          { status: "DONE", repeatSourceId: "t", scheduledDate: "2026-10-20" },
          { status: "TODO", repeatSourceId: "t", scheduledDate: "2026-10-21" },
          { status: "TODO", scheduledDate: "2026-10-21" },
        ],
        "2026-10-20"
      )
    ).toBe(50);
  });
});

describe("dailyProgress", () => {
  const day = "2026-11-22";

  it("counts only what's placed on that day", () => {
    expect(
      dailyProgress(
        [
          { status: "DONE", scheduledDate: day, startTime: "09:00" },
          { status: "TODO", scheduledDate: day, startTime: "13:00" },
          { status: "TODO", scheduledDate: "2026-11-21", startTime: "09:00" }, // yesterday
          { status: "TODO", scheduledDate: null }, // still in the tray
          { status: "TODO", isRecurring: true }, // 🔁 template
        ],
        day
      )
    ).toBe(50);
  });

  it("returns 0 for a day with nothing on it", () => {
    expect(dailyProgress([{ status: "DONE", scheduledDate: "2026-11-21", startTime: "09:00" }], day)).toBe(0);
  });
});

describe("todosOnDay", () => {
  it("sorts by start time", () => {
    const day = "2026-11-22";
    const titles = todosOnDay(
      [
        { title: "b", status: "TODO", scheduledDate: day, startTime: "13:00" },
        { title: "a", status: "TODO", scheduledDate: day, startTime: "08:30" },
      ],
      day
    ).map((t) => t.title);
    expect(titles).toEqual(["a", "b"]);
  });
});
