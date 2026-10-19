import type { Locator, Page } from "@playwright/test";

/** Week grid height of one hour (ROW_HEIGHT_PX in PlannerCalendar.tsx). */
export const HOUR_PX = 96;

// dnd-kit swallows every click for 50ms after a drop (its PointerSensor
// detaches the click-blocking listener on a 50ms timer) — a person can't
// click that fast, but a test can, so let that window pass.
async function releaseDrag(page: Page) {
  await page.mouse.up();
  await page.waitForTimeout(100);
}

/**
 * Drags `source` onto `target` — its center, or `offsetY` px below its top
 * edge when given (the week grid's columns are taller than the viewport,
 * and where in a column you drop decides the time slot). The drop point is
 * kept inside the viewport either way.
 */
export async function dragElementTo(
  page: Page,
  source: Locator,
  target: Locator,
  offsetY?: number
) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  const viewport = page.viewportSize();
  if (!sourceBox || !targetBox) throw new Error("could not locate drag source/target");

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const wantedY = targetBox.y + (offsetY ?? targetBox.height / 2);
  const endY = viewport ? Math.min(Math.max(wantedY, 10), viewport.height - 10) : wantedY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX + ((endX - startX) * i) / steps,
      startY + ((endY - startY) * i) / steps
    );
  }
  await releaseDrag(page);
}

/** Drags `source` by a fixed pixel offset, for grids with no separate drop target. */
export async function dragElementBy(page: Page, source: Locator, dx: number, dy: number) {
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("could not locate drag source");

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
  }
  await releaseDrag(page);
}

export async function loginAsTestUser(page: Page) {
  const res = await page.request.post("/api/test/login");
  if (!res.ok()) throw new Error("test login failed");
}

export async function deleteGoalByTitle(page: Page, title: string) {
  const res = await page.request.get("/api/goals");
  const goals: { _id: string; title: string }[] = await res.json();
  const goal = goals.find((g) => g.title === title);
  if (goal) {
    await page.request.delete(`/api/goals/${goal._id}`);
  }
}

export async function deleteCategoryByName(page: Page, name: string) {
  const res = await page.request.get("/api/categories");
  const categories: { _id: string; name: string }[] = await res.json();
  const category = categories.find((c) => c.name === name);
  if (category) {
    await page.request.delete(`/api/categories/${category._id}`);
  }
}

export async function findTodoByTitle(page: Page, title: string) {
  const res = await page.request.get("/api/todos");
  const todos: {
    _id: string;
    title: string;
    scheduledDate?: string | null;
    startTime?: string | null;
    durationMinutes?: number;
    category?: string | null;
  }[] = await res.json();
  return todos.find((t) => t.title === title);
}
