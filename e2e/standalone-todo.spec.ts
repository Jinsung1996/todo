import { test, expect } from "@playwright/test";
import { dragElementTo, findTodoByTitle, loginAsTestUser } from "./helpers";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("일간 목표 페이지에서 목표 없이 바로 추가한 일정도 대시보드 캘린더에 올릴 수 있다", async ({
  page,
}) => {
  const unique = Date.now();
  const todoName = `단독 일정 ${unique}`;
  const customCategory = `나만의분류${unique}`;

  await loginAsTestUser(page);

  // Create it directly from the 일간 목표 page — no 연간/주간 목표 involved —
  // with a free-typed category (not picked from a fixed list).
  await page.goto("/daily");
  await page.getByPlaceholder("일간 목표 제목").fill(todoName);
  await page.getByPlaceholder("분류 (선택)").fill(customCategory);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(todoName)).toBeVisible();

  const created = await findTodoByTitle(page, todoName);
  expect(created).toBeTruthy();
  expect(created?.scheduledDate ?? null).toBeNull();
  expect(created?.category).toBe(customCategory);

  await page.goto("/");

  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  await expect(chip).toBeVisible();

  const todayColumn = page.locator(`[data-day-column="${todayKey()}"]`);
  const scheduleResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, chip, todayColumn);
  await scheduleResponse;

  await expect(page.locator("[data-event-block]", { hasText: todoName })).toBeVisible();
  const scheduled = await findTodoByTitle(page, todoName);
  expect(scheduled?.scheduledDate).toBe(todayKey());
  expect(scheduled?.startTime).toBeTruthy();

  if (created) {
    await page.request.delete(`/api/todos/${created._id}`);
  }
});
