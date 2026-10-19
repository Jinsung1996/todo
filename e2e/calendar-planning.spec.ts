import { test, expect, type Page } from "@playwright/test";
import { dragElementTo, loginAsTestUser } from "./helpers";

function dayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ApiTodo = { _id: string; title: string; scheduledDate?: string | null; startTime?: string | null };

async function todosTitled(page: Page, title: string) {
  const res = await page.request.get("/api/todos");
  return ((await res.json()) as ApiTodo[]).filter((t) => t.title === title);
}

async function createStandalone(page: Page, title: string) {
  const res = await page.request.post("/api/todos", { data: { title } });
  if (!res.ok()) throw new Error("create failed");
}

test("같은 일간 목표를 하루에 여러 번(오전/오후) 넣고, 다음 주 캘린더에도 넣을 수 있다", async ({
  page,
}) => {
  const todoName = `공부 ${Date.now()}`;
  await loginAsTestUser(page);
  await createStandalone(page, todoName);
  await page.goto("/");

  const chip = page.locator("[data-unscheduled-chip]", { hasText: todoName });
  const todayColumn = page.locator(`[data-day-column="${dayKey()}"]`);

  // First drop places the todo itself, at the slot under the pointer.
  const placeResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(page, chip, todayColumn, 100); // ~08:00
  await placeResponse;

  // Second drop on the same day places another occurrence further down.
  const copyResponse = page.waitForResponse(
    (res) => res.url().includes("/copy") && res.request().method() === "POST"
  );
  await dragElementTo(page, chip, todayColumn, 400); // ~11:00
  await copyResponse;

  await expect(page.locator("[data-event-block]", { hasText: todoName })).toHaveCount(2);
  await expect(chip).toHaveCount(1);
  const placed = await todosTitled(page, todoName);
  expect(placed.map((t) => t.scheduledDate)).toEqual([dayKey(), dayKey()]);
  expect(new Set(placed.map((t) => t.startTime)).size).toBe(2);

  // Next week: navigate forward and drop it there too.
  const label = page.locator("[data-calendar-label]");
  const thisWeekLabel = await label.textContent();
  await page.getByTitle("다음").click();
  await expect(label).not.toHaveText(thisWeekLabel ?? "");
  const nextWeekColumn = page.locator(`[data-day-column="${dayKey(7)}"]`);
  await expect(nextWeekColumn).toBeVisible();

  const nextWeekResponse = page.waitForResponse(
    (res) => res.url().includes("/copy") && res.request().method() === "POST"
  );
  await dragElementTo(page, chip, nextWeekColumn, 100);
  await nextWeekResponse;
  await expect(page.locator("[data-event-block]", { hasText: todoName })).toHaveCount(1);
  expect((await todosTitled(page, todoName)).map((t) => t.scheduledDate)).toContain(dayKey(7));

  await page.getByRole("button", { name: "오늘" }).click();
  await expect(label).toHaveText(thisWeekLabel ?? "");

  for (const t of await todosTitled(page, todoName)) {
    await page.request.delete(`/api/todos/${t._id}`);
  }
});

test("월간 캘린더(12개월)에서 몇 달 뒤 날짜에 바로 일정을 넣고, 다른 날로 옮길 수 있다", async ({
  page,
}) => {
  const todoName = `토익 시험 ${Date.now()}`;
  await loginAsTestUser(page);
  await page.goto("/");

  await page.getByRole("tab", { name: "월간" }).click();
  await expect(page.locator("[data-month-tab]")).toHaveCount(12);

  const target = new Date();
  target.setDate(1);
  target.setMonth(target.getMonth() + 3);
  const monthKey = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  await page.locator(`[data-month-tab="${monthKey}"]`).click();
  await expect(page.locator("[data-calendar-label]")).toHaveText(
    `${target.getFullYear()}년 ${target.getMonth() + 1}월`
  );

  const date = `${monthKey}-15`;
  const cell = page.locator(`[data-month-day="${date}"]`);
  await cell.hover();
  await cell.getByTitle("이 날짜에 일정 추가").click();
  const createResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/todos") && res.request().method() === "POST"
  );
  await cell.getByPlaceholder("일정 제목 + Enter").fill(todoName);
  await cell.getByPlaceholder("일정 제목 + Enter").press("Enter");
  await createResponse;

  await expect(cell.locator("[data-month-item]", { hasText: todoName })).toBeVisible();
  const [created] = await todosTitled(page, todoName);
  expect(created.scheduledDate).toBe(date);
  expect(created.startTime).toBeTruthy();

  // Drag it to the 16th; its time of day stays the same.
  const moveResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragElementTo(
    page,
    cell.locator("[data-month-item]", { hasText: todoName }),
    page.locator(`[data-month-day="${monthKey}-16"]`)
  );
  await moveResponse;
  await expect(
    page.locator(`[data-month-day="${monthKey}-16"] [data-month-item]`, { hasText: todoName })
  ).toBeVisible();
  const [moved] = await todosTitled(page, todoName);
  expect(moved.scheduledDate).toBe(`${monthKey}-16`);
  expect(moved.startTime).toBe(created.startTime);

  await page.request.delete(`/api/todos/${created._id}`);
});
