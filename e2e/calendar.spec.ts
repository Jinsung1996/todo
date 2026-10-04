import { test, expect } from "@playwright/test";
import { deleteGoalByTitle, dragElementTo } from "./helpers";

test("캘린더에서 할일을 그날에 배정하고 드래그로 완료 처리한다", async ({ page }) => {
  const unique = Date.now();
  const goalName = `캘린더 목표 ${unique}`;
  const weekName = `캘린더 주간계획 ${unique}`;
  const todoName = `캘린더 할일 ${unique}`;

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

  await page.goto("/calendar");

  // Assign the todo to the selected (today) day via the picker.
  await page.locator("select").selectOption({ label: todoName });
  const assignResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await page.getByRole("button", { name: "추가" }).click();
  await assignResponse;

  const pendingBox = page.locator("div", { hasText: "이 날의 할 일" }).last();
  await expect(pendingBox.getByText(todoName)).toBeVisible();

  const doneBox = page.locator("div", { hasText: "완료" }).last();

  const moveResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, pendingBox.getByText(todoName), doneBox);
  await moveResponse;

  await expect(doneBox.getByText(todoName)).toBeVisible();

  await page.reload();
  const reloadedDoneBox = page.locator("div", { hasText: "완료" }).last();
  await expect(reloadedDoneBox.getByText(todoName)).toBeVisible();

  // Unassigning removes it from the day's boxes (it still exists as a todo,
  // so it remains selectable in the picker — just no longer scheduled).
  await reloadedDoneBox.getByText(todoName).locator("..").getByTitle("이 날짜에서 빼기").click();
  await expect(reloadedDoneBox.getByText(todoName)).toHaveCount(0);
  const reloadedPendingBox = page.locator("div", { hasText: "이 날의 할 일" }).last();
  await expect(reloadedPendingBox.getByText(todoName)).toHaveCount(0);

  await deleteGoalByTitle(page, goalName);
});
