import { test, expect } from "@playwright/test";
import { dragElementTo, HOUR_PX, loginAsTestUser } from "./helpers";

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ApiTodo = {
  _id: string;
  title: string;
  isRecurring?: boolean;
  scheduledDate?: string | null;
  startTime?: string | null;
  repeat?: { startTime: string; weekdays: number[] } | null;
};

async function todosTitled(page: import("@playwright/test").Page, title: string) {
  const res = await page.request.get("/api/todos");
  return ((await res.json()) as ApiTodo[]).filter((t) => t.title === title);
}

test("반복 일정은 자동으로 넘어오지 않고, 끌어다 놓을 때마다 그날 일정이 하나씩 추가된다", async ({
  page,
}) => {
  const unique = Date.now();
  const todoName = `점심식사 ${unique}`;

  await loginAsTestUser(page);

  await page.goto("/daily");
  await page.getByPlaceholder("일간 목표 제목").fill(todoName);
  await page.getByText("반복 일정").click();
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.locator("li", { hasText: todoName })).toBeVisible();

  // Nothing lands on the calendar on its own — it only waits in the tray.
  await page.goto("/");
  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  await expect(chip).toBeVisible();
  await expect(page.locator("[data-event-block]", { hasText: todoName })).toHaveCount(0);

  // Dropping it places a copy for that day, with its own status select.
  const todayColumn = page.locator(`[data-day-column="${dayKey()}"]`);
  const copyResponse = page.waitForResponse(
    (res) => res.url().includes("/copy") && res.request().method() === "POST"
  );
  await dragElementTo(page, chip, todayColumn, HOUR_PX * 9); // ~09:00 (grid opens at 07시)
  // Asked whether to repeat it from now on — just today, this time.
  await page.getByRole("button", { name: "이 날만 추가" }).click();
  expect((await copyResponse).status()).toBe(201);

  const block = page.locator("[data-event-block]", { hasText: todoName });
  await expect(block).toHaveCount(1);
  await expect(block.getByRole("combobox")).toHaveValue("TODO");

  // The template stays in the tray, ready for tomorrow (or a second meal).
  await expect(chip).toBeVisible();
  const all = await todosTitled(page, todoName);
  expect(all).toHaveLength(2);
  const template = all.find((t) => t.isRecurring)!;
  expect(template.scheduledDate ?? null).toBeNull();

  // Completing today's copy counts toward today's 일간 완료 and leaves the
  // template alone.
  const doneResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await block.getByRole("combobox").selectOption("DONE");
  await doneResponse;
  await expect(page.locator("[data-agenda-item]", { hasText: todoName })).toHaveClass(
    /line-through/
  );
  await expect(page.locator("[data-today-progress]")).toContainText("%");
  await expect(chip).toBeVisible();

  for (const t of await todosTitled(page, todoName)) {
    await page.request.delete(`/api/todos/${t._id}`);
  }
});

test("반복 일정을 끌어다 놓을 때 '앞으로도 같은 시간에'를 고르면 고른 요일마다 같은 시간에 들어간다", async ({
  page,
}) => {
  const todoName = `출근 준비 ${Date.now()}`;
  await loginAsTestUser(page);
  const created = await page.request.post("/api/todos", {
    data: { title: todoName, isRecurring: true },
  });
  expect(created.ok()).toBe(true);

  await page.goto("/");
  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  const todayColumn = page.locator(`[data-day-column="${dayKey()}"]`);
  await dragElementTo(page, chip, todayColumn, HOUR_PX * 9);

  const dialog = page.locator("[data-repeat-dialog]");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "앞으로도 같은 시간에 반복" }).click();
  await dialog.getByText("주중 (월–금)").click();
  const repeatResponse = page.waitForResponse(
    (res) => res.url().includes("/repeat") && res.request().method() === "POST"
  );
  await dialog.getByRole("button", { name: "반복 추가" }).click();
  expect((await repeatResponse).status()).toBe(201);
  await expect(dialog).toHaveCount(0);

  const all = await todosTitled(page, todoName);
  const template = all.find((t) => t.isRecurring)!;
  expect(template.repeat?.weekdays.sort()).toEqual([1, 2, 3, 4, 5]);
  const copies = all.filter((t) => !t.isRecurring);
  // Today (where it was dropped) plus every 주중 day ahead, all at one time.
  expect(copies.some((t) => t.scheduledDate === dayKey())).toBe(true);
  expect(new Set(copies.map((t) => t.startTime)).size).toBe(1);
  for (const t of copies.filter((c) => c.scheduledDate !== dayKey())) {
    const day = new Date(`${t.scheduledDate}T00:00:00`).getDay();
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(5);
  }
  expect(copies.length).toBeGreaterThan(30);
  await expect(chip).toContainText("주중");

  // 반복 중지 from the dialog leaves today's copy and drops the rest.
  await dragElementTo(page, chip, todayColumn, HOUR_PX * 9);
  const stopResponse = page.waitForResponse(
    (res) => res.url().includes("/repeat") && res.request().method() === "DELETE"
  );
  await dialog.getByRole("button", { name: "반복 중지" }).click();
  expect((await stopResponse).status()).toBe(200);
  const left = await todosTitled(page, todoName);
  expect(left.find((t) => t.isRecurring)?.repeat ?? null).toBeNull();
  expect(left.filter((t) => !t.isRecurring).every((t) => t.scheduledDate! <= dayKey())).toBe(true);

  for (const t of left) {
    await page.request.delete(`/api/todos/${t._id}`);
  }
});
