import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers";

function key(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("일간 목표는 날짜별로 보이고, 완료(%)는 그날 일정만 센다", async ({ page }) => {
  const unique = Date.now();
  const yesterdayTodo = `어제 일정 ${unique}`;
  const todayA = `오늘 일정A ${unique}`;
  const todayB = `오늘 일정B ${unique}`;

  await loginAsTestUser(page);
  const ids: string[] = [];
  for (const [title, scheduledDate] of [
    [yesterdayTodo, key(-1)],
    [todayA, key(0)],
    [todayB, key(0)],
  ]) {
    const res = await page.request.post("/api/todos", { data: { title, scheduledDate } });
    ids.push((await res.json())._id);
  }
  // Mark one of today's done.
  await page.request.patch(`/api/todos/${ids[1]}`, { data: { status: "DONE" } });

  await page.goto("/daily");
  await expect(page.getByText(todayA)).toBeVisible();
  await expect(page.getByText(todayB)).toBeVisible();
  await expect(page.getByText(yesterdayTodo)).toHaveCount(0);
  await expect(page.getByText(/1 \/ 2 완료 \(50%\)/)).toBeVisible();

  await page.getByRole("button", { name: "이전 날" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${key(-1)}`));
  await expect(page.getByText(yesterdayTodo)).toBeVisible();
  await expect(page.getByText(todayA)).toHaveCount(0);

  await page.getByRole("button", { name: "오늘" }).click();
  await expect(page.getByText(todayA)).toBeVisible();

  // Dashboard card counts today only — yesterday's open item doesn't drag it down.
  await page.goto("/");
  await expect(page.getByRole("link", { name: /오늘 완료\(%\)\s*50%/ })).toBeVisible();

  for (const id of ids) await page.request.delete(`/api/todos/${id}`);
});
