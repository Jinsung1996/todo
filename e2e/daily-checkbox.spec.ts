import { test, expect } from "@playwright/test";
import { deleteGoalByTitle, loginAsTestUser } from "./helpers";

test("할 일 목록에서 체크박스로 완료 표시하면 초록색으로 바뀐다", async ({ page }) => {
  const unique = Date.now();
  const goalName = `체크 목표 ${unique}`;
  const weekName = `체크 주간계획 ${unique}`;
  const todoName = `체크 할일 ${unique}`;

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

  // Not on the calendar yet, so it sits under 날짜 미정.
  await page.goto("/daily");
  const row = page.locator("li", { hasText: todoName });
  const checkbox = row.getByRole("checkbox");

  await expect(checkbox).not.toBeChecked();
  await expect(row).not.toHaveClass(/bg-emerald-50/);

  const patchResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await checkbox.check();
  await patchResponse;

  // Checked items turn green and stay visible until the page reloads.
  await expect(row.locator("a")).toHaveClass(/bg-emerald-50/);
  await expect(row.getByText(todoName)).toHaveClass(/line-through/);

  // Unchecking reverts it back to an active (non-green) todo.
  const unchecked = page.waitForResponse((res) => res.request().method() === "PATCH");
  await row.getByRole("checkbox").uncheck();
  await unchecked;
  await expect(row.locator("a")).not.toHaveClass(/bg-emerald-50/);

  // Once done, a 날짜 미정 item no longer clutters the list after a reload.
  const saved = page.waitForResponse((res) => res.request().method() === "PATCH");
  await row.getByRole("checkbox").check();
  await saved;
  await page.reload();
  await expect(page.getByRole("heading", { name: /오늘/ })).toBeVisible();
  await expect(page.locator("li", { hasText: todoName })).toHaveCount(0);

  await deleteGoalByTitle(page, goalName);
});
