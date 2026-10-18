import { test, expect } from "@playwright/test";
import { dragElementTo, findTodoByTitle, loginAsTestUser } from "./helpers";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

test("매일 반복 습관은 완료해도 사라지지 않고 다음 날 다시 체크할 수 있다", async ({ page }) => {
  const unique = Date.now();
  const todoName = `아침 식사 ${unique}`;

  await loginAsTestUser(page);

  // Create it as a recurring daily habit from the 일간 목표 page.
  await page.goto("/daily");
  await page.getByPlaceholder("일간 목표 제목").fill(todoName);
  await page.getByText("매일 반복").click();
  await page.getByRole("button", { name: "추가" }).click();

  const row = page.locator("li", { hasText: todoName });
  await expect(row).toBeVisible();
  await expect(row.getByRole("checkbox")).not.toBeChecked();

  const created = await findTodoByTitle(page, todoName);
  expect(created).toBeTruthy();

  // Drag it onto today's column on the dashboard calendar.
  await page.goto("/");
  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  await expect(chip).toBeVisible();

  const todayColumn = page.locator(`[data-day-column="${todayKey()}"]`);
  const scheduleResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, chip, todayColumn);
  await scheduleResponse;

  const block = page.locator("[data-event-block]", { hasText: todoName });
  await expect(block).toBeVisible();

  // The block shows a plain checkbox (not the 진행전/중/완료 select), since a
  // daily habit is just "done today or not".
  const blockCheckbox = block.getByRole("checkbox");
  await expect(block.getByRole("combobox")).toHaveCount(0);
  await expect(blockCheckbox).not.toBeChecked();

  const checkResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await blockCheckbox.check();
  await checkResponse;
  await expect(block.getByTitle(todoName)).toHaveClass(/line-through/);

  // Checked for today, but it never actually leaves the tray or the active
  // 일간 목표 list — there's nothing to re-create tomorrow.
  await expect(chip).toBeVisible();
  const agendaItem = page.locator(`[data-agenda-item="${created!._id}"]`);
  await expect(agendaItem).toHaveClass(/line-through/);

  await page.goto("/daily?status=all");
  const reloadedRow = page.locator("li", { hasText: todoName });
  await expect(reloadedRow).toBeVisible();
  await expect(reloadedRow.getByRole("checkbox")).toBeChecked();

  // Simulate "a new day" by moving its completion marker to yesterday
  // directly (there's no way to turn the system clock in a test) and
  // confirming it's unchecked again — exactly the reset this feature exists
  // for, with nothing re-created.
  await page.request.patch(`/api/todos/${created!._id}`, {
    data: { lastCompletedDate: yesterdayKey() },
  });
  await page.reload();
  const nextDayRow = page.locator("li", { hasText: todoName });
  await expect(nextDayRow.getByRole("checkbox")).not.toBeChecked();

  await page.request.delete(`/api/todos/${created!._id}`);
});
