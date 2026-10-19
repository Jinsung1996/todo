import { describe, expect, it } from "vitest";
import type { Todo } from "@/types";
import { dropPlacesCopy, trayTodos } from "./tray";

function todo(overrides: Partial<Todo>): Todo {
  return { _id: Math.random().toString(36), title: "공부", status: "TODO", ...overrides };
}

describe("trayTodos", () => {
  it("collapses repeated occurrences of the same 일간 목표 into one chip", () => {
    const morning = todo({ scheduledDate: "2026-10-20", startTime: "09:00" });
    const afternoon = todo({ scheduledDate: "2026-10-20", startTime: "14:00" });
    expect(trayTodos([morning, afternoon])).toEqual([morning]);
  });

  it("prefers a recurring template, then an unplaced copy, as the group's chip", () => {
    const placed = todo({ scheduledDate: "2026-10-20", startTime: "09:00" });
    const unplaced = todo({});
    expect(trayTodos([placed, unplaced])).toEqual([unplaced]);

    const template = todo({ title: "점심식사", isRecurring: true });
    const lunchToday = todo({ title: "점심식사", scheduledDate: "2026-10-20", startTime: "12:00" });
    expect(trayTodos([lunchToday, template])).toEqual([template]);
  });

  it("keeps different categories or 주간 목표 apart", () => {
    const a = todo({ category: "공부" });
    const b = todo({ category: "운동" });
    const c = todo({ category: "공부", weeklyPlanId: "w1" });
    expect(trayTodos([a, b, c])).toHaveLength(3);
  });

  it("drops finished one-off todos but always keeps recurring templates", () => {
    const done = todo({ status: "DONE" });
    const template = todo({ title: "점심식사", isRecurring: true });
    expect(trayTodos([done, template])).toEqual([template]);
  });
});

describe("dropPlacesCopy", () => {
  it("places the todo itself only while it isn't on any day yet", () => {
    expect(dropPlacesCopy(todo({}))).toBe(false);
    expect(dropPlacesCopy(todo({ scheduledDate: "2026-10-20" }))).toBe(true);
    expect(dropPlacesCopy(todo({ isRecurring: true }))).toBe(true);
  });
});
