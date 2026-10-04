import { test, expect } from "@playwright/test";
import { deleteGoalByTitle } from "./helpers";

test("할 일 목록에서 체크박스로 완료 표시하면 초록색으로 바뀐다", async ({ page }) => {
  const unique = Date.now();
  const goalName = `체크 목표 ${unique}`;
  const weekName = `체크 주간계획 ${unique}`;
  const todoName = `체크 할일 ${unique}`;

  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(goalName);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(goalName).click();

  await page.getByPlaceholder("주간계획 제목").fill(weekName);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill("2026-01-01");
  await dateInputs.nth(1).fill("2026-01-07");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(weekName).click();

  await page.getByPlaceholder("할일 제목").fill(todoName);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(todoName)).toBeVisible();

  await page.goto("/daily?status=all");
  const row = page.locator("li", { hasText: todoName });
  const checkbox = row.getByRole("checkbox");

  await expect(checkbox).not.toBeChecked();
  await expect(row).not.toHaveClass(/bg-emerald-50/);

  const patchResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await checkbox.check();
  await patchResponse;

  // Checked items turn green and stay visible in the "all" tab so progress is visible at a glance.
  await expect(row.locator("a")).toHaveClass(/bg-emerald-50/);
  await expect(row.getByText(todoName)).toHaveClass(/line-through/);

  await page.reload();
  const reloadedRow = page.locator("li", { hasText: todoName });
  await expect(reloadedRow.getByRole("checkbox")).toBeChecked();
  await expect(reloadedRow.locator("a")).toHaveClass(/bg-emerald-50/);

  // Unchecking reverts it back to an active (non-green) todo.
  await reloadedRow.getByRole("checkbox").uncheck();
  await expect(reloadedRow.locator("a")).not.toHaveClass(/bg-emerald-50/);

  await deleteGoalByTitle(page, goalName);
});
