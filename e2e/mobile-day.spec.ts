import { test, expect, type Locator, type Page } from "@playwright/test";
import { dragElementTo, loginAsTestUser } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

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
  status: string;
  isRecurring?: boolean;
  scheduledDate?: string | null;
  startTime?: string | null;
  durationMinutes?: number;
};

async function todosTitled(page: Page, title: string) {
  const res = await page.request.get("/api/todos");
  return ((await res.json()) as ApiTodo[]).filter((t) => t.title === title);
}

async function swipe(target: Locator, dx: number) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 200;
  const touch = (clientX: number) => [{ identifier: 1, clientX, clientY: y }];
  await target.dispatchEvent("touchstart", { touches: touch(x), changedTouches: touch(x) });
  await target.dispatchEvent("touchend", { touches: [], changedTouches: touch(x + dx) });
}

test("휴대폰에서는 하루짜리 세로 캘린더가 나오고, 눌러서 시간을 넣거나 옆으로 밀어 날짜를 넘긴다", async ({
  page,
}) => {
  const unique = Date.now();
  const study = `모바일 공부 ${unique}`;
  const lunch = `모바일 점심 ${unique}`;
  await loginAsTestUser(page);
  await page.request.post("/api/todos", { data: { title: study } });
  await page.request.post("/api/todos", { data: { title: lunch, isRecurring: true } });

  await page.goto("/");
  // Phone layout: the one-day view and bottom tabs, no week grid or sidebar.
  await expect(page.locator(`[data-mobile-day="${dayKey()}"]`)).toBeVisible();
  await expect(page.locator("[data-day-column]")).toHaveCount(0);
  await expect(page.locator("[data-mobile-nav]")).toBeVisible();
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth).toBeLessThanOrEqual(390);

  // Tap a tray item → type a time → it lands at that time today.
  await page.locator("[data-mobile-chip]", { hasText: study }).click();
  const sheet = page.locator("[data-mobile-sheet]");
  await sheet.locator("[data-time-select]").selectOption("10:00");
  await sheet.getByRole("button", { name: "추가" }).click();
  const block = page.locator("[data-mobile-block]", { hasText: study });
  await expect(block).toContainText("10:00–11:00");
  await expect.poll(async () => (await todosTitled(page, study))[0]?.startTime).toBe("10:00");

  // Tap the block → change status, time and length.
  await block.click();
  await sheet.getByRole("button", { name: "진행 중" }).click();
  await sheet.locator("[data-time-select]").selectOption("11:30");
  await sheet.locator("[data-duration-select]").selectOption("90");
  await sheet.getByRole("button", { name: "시간 저장" }).click();
  await expect(block).toContainText("11:30–13:00");
  await expect
    .poll(async () => {
      const t = (await todosTitled(page, study))[0];
      return [t.status, t.startTime, t.durationMinutes].join(" ");
    })
    .toBe("DOING 11:30 90");

  // A 🔁 item goes straight to the repeat question, time included.
  await page.locator("[data-mobile-chip]", { hasText: lunch }).click();
  const repeatDialog = page.locator("[data-repeat-dialog]");
  await repeatDialog.locator("[data-time-select]").selectOption("12:00");
  await repeatDialog.getByRole("button", { name: "이 날만 추가" }).click();
  await expect(page.locator("[data-mobile-block]", { hasText: lunch })).toContainText("12:00");

  // Swipe left → tomorrow (empty), swipe right → back to today.
  const scroller = page.locator("[data-mobile-scroller]");
  await swipe(scroller, -150);
  await expect(page.locator(`[data-mobile-day="${dayKey(1)}"]`)).toBeVisible();
  await expect(page.locator("[data-mobile-block]")).toHaveCount(0);
  // Dragging a tray item (mouse here) drops it at the time under it.
  const chip = page.locator("[data-mobile-chip]", { hasText: study });
  await scroller.evaluate((el) => (el.scrollTop = 7 * 72)); // 07시 at the top
  await dragElementTo(page, chip, page.locator("[data-mobile-column]"), 9 * 72 + 36);
  await expect(page.locator("[data-mobile-block]", { hasText: study })).toHaveCount(1);
  await expect
    .poll(async () =>
      (await todosTitled(page, study)).some((t) => t.scheduledDate === dayKey(1))
    )
    .toBe(true);
  await swipe(scroller, 150);
  await expect(page.locator(`[data-mobile-day="${dayKey()}"]`)).toBeVisible();
  await expect(page.locator("[data-mobile-block]")).toHaveCount(2);

  for (const title of [study, lunch]) {
    for (const t of await todosTitled(page, title)) {
      await page.request.delete(`/api/todos/${t._id}`);
    }
  }
});
