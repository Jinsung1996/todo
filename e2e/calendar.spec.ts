import { test, expect } from "@playwright/test";
import {
  deleteGoalByTitle,
  dragElementBy,
  findTodoByTitle,
  loginAsTestUser,
} from "./helpers";

test("캘린더 주간 그리드에서 할일을 배정, 체크, 시간 이동, 배정 해제한다", async ({ page }) => {
  const unique = Date.now();
  const goalName = `캘린더 목표 ${unique}`;
  const weekName = `캘린더 주간계획 ${unique}`;
  const todoName = `캘린더 할일 ${unique}`;

  await loginAsTestUser(page);
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

  // Assign the (still-unscheduled) todo to today's column via the picker;
  // the server auto-places it in the first open time slot.
  await page.locator("select").first().selectOption({ label: todoName });
  const assignResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await page.getByRole("button", { name: "추가" }).click();
  await assignResponse;

  const block = page.locator(`[data-event-block]`, { hasText: todoName });
  await expect(block).toBeVisible();

  const initialTodo = await findTodoByTitle(page, todoName);
  expect(initialTodo?.startTime).toBeTruthy();

  // Checking the block's own checkbox marks it done in place (no drag needed).
  const checkbox = block.getByRole("checkbox");
  await expect(checkbox).not.toBeChecked();
  const checkResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await checkbox.check();
  await checkResponse;
  await expect(block).toHaveClass(/line-through/);

  await page.reload();
  const reloadedBlock = page.locator(`[data-event-block]`, { hasText: todoName });
  await expect(reloadedBlock.getByRole("checkbox")).toBeChecked();

  // Dragging the block down by two hour-rows (2 * 48px) reschedules its time,
  // Google-Calendar style.
  const moveResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementBy(page, reloadedBlock, 0, 96);
  await moveResponse;

  await expect(async () => {
    const moved = await findTodoByTitle(page, todoName);
    expect(moved?.startTime).not.toBe(initialTodo?.startTime);
  }).toPass();

  // Unassigning removes it from the grid and makes it selectable again in
  // the "add to this week" picker (still exists, just not scheduled).
  const currentBlock = page.locator(`[data-event-block]`, { hasText: todoName });
  const unassignResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await currentBlock.getByTitle("이 날짜에서 빼기").click();
  await unassignResponse;
  await expect(page.locator(`[data-event-block]`, { hasText: todoName })).toHaveCount(0);
  await expect(page.locator("select").first().locator(`option`, { hasText: todoName })).toHaveCount(1);

  await deleteGoalByTitle(page, goalName);
});
