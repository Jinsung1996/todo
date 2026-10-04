import type { Locator, Page } from "@playwright/test";

export async function dragElementTo(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("could not locate drag source/target");

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX + ((endX - startX) * i) / steps,
      startY + ((endY - startY) * i) / steps
    );
  }
  await page.mouse.up();
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
