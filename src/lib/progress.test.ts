import { describe, expect, it } from "vitest";
import { weeklyProgress } from "./progress";

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
});
