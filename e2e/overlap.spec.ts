import { test, expect, type Page } from "@playwright/test";
import { findTodoByTitle, HOUR_PX, loginAsTestUser } from "./helpers";

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function placeToday(page: Page, title: string, startTime: string, durationMinutes: number) {
  const res = await page.request.post("/api/todos", { data: { title } });
  if (!res.ok()) throw new Error("create failed");
  const { _id } = (await res.json()) as { _id: string };
  await page.request.patch(`/api/todos/${_id}`, {
    data: { scheduledDate: todayKey(), startTime, durationMinutes },
  });
  return _id;
}

/** The event block (data-event-block id) painted topmost at a point. */
function blockAt(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) =>
      document.elementFromPoint(px, py)?.closest("[data-event-block]")?.getAttribute("data-event-block"),
    [x, y]
  );
}

test("겹친 일정은 짧은 일정이 위에 보이고, 긴 일정도 마우스를 올리면 아래 손잡이로 길이를 줄일 수 있다", async ({
  page,
}) => {
  const stamp = Date.now();
  await loginAsTestUser(page);
  // 공부 10:00–14:00, with a snack covering its last half hour — and so
  // the bottom resize handle.
  const studyId = await placeToday(page, `공부 ${stamp}`, "10:00", 240);
  const snackId = await placeToday(page, `간식 ${stamp}`, "13:30", 30);
  await page.goto("/");

  const study = page.locator(`[data-event-block="${studyId}"]`);
  await study.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const handle = await study.locator("[data-resize-handle]").boundingBox();
  const strip = await study.locator("[data-drag-handle]").boundingBox();
  if (!handle || !strip) throw new Error("could not locate study handles");
  const handleX = handle.x + handle.width / 2;
  const handleY = handle.y + handle.height / 2;

  // The shorter block is painted on top of the longer one.
  expect(await blockAt(page, handleX, handleY)).toBe(snackId);

  // Pointing at the study block's visible strip brings it to the front...
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
  await page.mouse.move(strip.x + strip.width / 2, handleY, { steps: 8 });
  await page.mouse.move(handleX, handleY, { steps: 4 });
  expect(await blockAt(page, handleX, handleY)).toBe(studyId);

  // ...so its bottom handle drags it 30 minutes shorter.
  const resizeResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await page.mouse.down();
  await page.mouse.move(handleX, handleY - HOUR_PX / 2, { steps: 8 });
  await page.mouse.up();
  await resizeResponse;

  await expect(async () => {
    expect((await findTodoByTitle(page, `공부 ${stamp}`))?.durationMinutes).toBe(210);
  }).toPass();

  for (const id of [studyId, snackId]) await page.request.delete(`/api/todos/${id}`);
});
