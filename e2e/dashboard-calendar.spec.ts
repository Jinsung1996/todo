import { test, expect } from "@playwright/test";
import {
  deleteGoalByTitle,
  dragElementBy,
  dragElementTo,
  findTodoByTitle,
  loginAsTestUser,
} from "./helpers";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("대시보드 캘린더에서 할일을 끌어다 당일 일정을 만들고, 진행 전/진행 중/완료를 바꾸고, 30분 단위로 옮긴다", async ({
  page,
}) => {
  const unique = Date.now();
  const goalName = `대시캘 목표 ${unique}`;
  const weekName = `대시캘 주간계획 ${unique}`;
  const todoName = `대시캘 할일 ${unique}`;

  await loginAsTestUser(page);
  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(goalName);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(goalName).click();

  await page.getByPlaceholder("주간 목표 제목").fill(weekName);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill("2026-01-01");
  await dateInputs.nth(1).fill("2026-01-07");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(weekName).click();

  await page.getByPlaceholder("일간 목표 제목").fill(todoName);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(todoName)).toBeVisible();

  await page.goto("/");

  // The still-unscheduled todo shows up as a draggable chip in the tray.
  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  await expect(chip).toBeVisible();

  // Dragging it onto today's column schedules it (server auto-picks a time).
  const todayColumn = page.locator(`[data-day-column="${todayKey()}"]`);
  const scheduleResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, chip, todayColumn);
  await scheduleResponse;

  const block = page.locator("[data-event-block]", { hasText: todoName });
  await expect(block).toBeVisible();
  const scheduledTodo = await findTodoByTitle(page, todoName);
  expect(scheduledTodo?.scheduledDate).toBe(todayKey());
  expect(scheduledTodo?.startTime).toBeTruthy();

  // Still not done, so it keeps showing in the tray too (multi-day 진행 중
  // items need to stay draggable onto other days even once scheduled).
  await expect(chip).toBeVisible();

  // The "오늘" sidebar agenda also picks it up, colored by status rather
  // than category.
  const agendaItem = page.locator(`[data-agenda-item="${scheduledTodo!._id}"]`);
  await expect(agendaItem).toBeVisible();
  await expect(agendaItem).not.toHaveClass(/line-through/);

  // 진행 전 -> 진행 중 is an explicit pick and must NOT, by itself, advance
  // any further — only an explicit 완료 selection (or a status change from
  // the detail page) marks it done.
  const statusSelect = block.getByRole("combobox");
  await expect(statusSelect).toHaveValue("TODO");
  const doingResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await statusSelect.selectOption("DOING");
  await doingResponse;
  await expect(block.getByTitle(todoName)).not.toHaveClass(/line-through/);
  // Still mid-flight: not done, so no auto-promotion and it still stays in
  // the tray (e.g. to be dragged onto tomorrow too).
  await expect(chip).toBeVisible();

  const doneResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await statusSelect.selectOption("DONE");
  await doneResponse;
  await expect(block.getByTitle(todoName)).toHaveClass(/line-through/);
  await expect(agendaItem).toHaveClass(/line-through/);
  // Done items drop out of the tray — nothing left to schedule.
  await expect(chip).toHaveCount(0);

  await page.reload();
  const reloadedBlock = page.locator("[data-event-block]", { hasText: todoName });
  await expect(reloadedBlock.getByRole("combobox")).toHaveValue("DONE");

  // Back to 진행 전 — reappears in the tray (still scheduled on this same
  // day too) and unassigning removes just the grid placement.
  const revertResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await reloadedBlock.getByRole("combobox").selectOption("TODO");
  await revertResponse;
  await expect(page.locator("[data-unscheduled-chip]", { hasText: todoName })).toBeVisible();

  const unassignResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await reloadedBlock.getByTitle("이 날짜에서 빼기").click();
  await unassignResponse;
  await expect(page.locator("[data-event-block]", { hasText: todoName })).toHaveCount(0);
  await expect(page.locator("[data-unscheduled-chip]", { hasText: todoName })).toBeVisible();

  // Re-schedule it, then exercise the 30-minute reposition drag last — no
  // further UI interaction follows a raw-mouse drag in this test, which
  // keeps the drag library's pointer-capture state from interfering with a
  // subsequent click (see git history for the app-level fix this covers).
  const rescheduleResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, page.locator("[data-unscheduled-chip]", { hasText: todoName }), todayColumn);
  await rescheduleResponse;

  const rescheduled = await findTodoByTitle(page, todoName);
  const finalBlock = page.locator("[data-event-block]", { hasText: todoName });
  await expect(finalBlock).toBeVisible();

  const moveResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  // Drag from the dedicated handle strip, not the block body (which is now
  // mostly taken up by the status select and duration buttons).
  await finalBlock.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await dragElementBy(page, finalBlock.locator("[data-drag-handle]"), 0, 48); // one half-hour row
  await moveResponse;

  await expect(async () => {
    const moved = await findTodoByTitle(page, todoName);
    const before = rescheduled!.startTime as string;
    const [bh, bm] = before.split(":").map(Number);
    const expectedMinutes = bh * 60 + bm + 30;
    const expected = `${String(Math.floor(expectedMinutes / 60)).padStart(2, "0")}:${String(
      expectedMinutes % 60
    ).padStart(2, "0")}`;
    expect(moved?.startTime).toBe(expected);
  }).toPass();

  // Dragging the bottom edge down by one hour (96px) extends the duration —
  // the Google-Calendar-style resize. Also last in the test, for the same
  // raw-mouse-drag-then-click reason as above.
  const beforeResize = await findTodoByTitle(page, todoName);
  const resizeResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await finalBlock.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await dragElementBy(page, finalBlock.locator("[data-resize-handle]"), 0, 96);
  await resizeResponse;

  await expect(async () => {
    const resized = await findTodoByTitle(page, todoName);
    expect(resized?.durationMinutes).toBe((beforeResize?.durationMinutes ?? 60) + 60);
  }).toPass();

  await deleteGoalByTitle(page, goalName);
});
