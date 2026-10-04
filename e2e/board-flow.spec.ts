import { test, expect, type Page } from "@playwright/test";
import { deleteGoalByTitle } from "./helpers";

async function dragCardToColumn(page: Page, cardText: string, columnLabel: string) {
  const card = page.getByText(cardText, { exact: true });
  const column = page.getByText(columnLabel, { exact: true }).locator("..");

  const cardBox = await card.boundingBox();
  const columnBox = await column.boundingBox();
  if (!cardBox || !columnBox) throw new Error("could not locate drag source/target");

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = columnBox.x + columnBox.width / 2;
  const endY = columnBox.y + columnBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Multiple intermediate steps so dnd-kit's PointerSensor registers movement.
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX + ((endX - startX) * i) / steps,
      startY + ((endY - startY) * i) / steps
    );
  }
  await page.mouse.up();
}

test("할일 생성 → 보드에서 드래그로 done 이동 → 주간 진행률 상승", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(`e2e 목표 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`e2e 목표 ${unique}`).click();

  await page.getByPlaceholder("주간계획 제목").fill(`e2e 주간계획 ${unique}`);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill("2026-01-01");
  await dateInputs.nth(1).fill("2026-01-07");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`e2e 주간계획 ${unique}`).click();

  await expect(page.getByText("0%")).toBeVisible();

  await page.getByPlaceholder("할일 제목").fill(`e2e 할일 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(`e2e 할일 ${unique}`)).toBeVisible();

  const patchResponse = page.waitForResponse(
    (res) => res.url().includes("/api/todos/") && res.request().method() === "PATCH"
  );
  await dragCardToColumn(page, `e2e 할일 ${unique}`, "완료");
  await patchResponse;

  await expect(page.getByText("100%")).toBeVisible({ timeout: 5000 });

  await page.reload();
  await expect(page.getByText("100%")).toBeVisible();

  await deleteGoalByTitle(page, `e2e 목표 ${unique}`);
});

test("네트워크 실패 시 드래그가 롤백된다", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(`e2e 롤백 목표 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`e2e 롤백 목표 ${unique}`).click();

  await page.getByPlaceholder("주간계획 제목").fill(`e2e 롤백 주간계획 ${unique}`);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill("2026-01-01");
  await dateInputs.nth(1).fill("2026-01-07");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`e2e 롤백 주간계획 ${unique}`).click();

  await page.getByPlaceholder("할일 제목").fill(`e2e 롤백 할일 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(`e2e 롤백 할일 ${unique}`)).toBeVisible();

  await page.route("**/api/todos/*", (route) => {
    if (route.request().method() === "PATCH") {
      return route.abort("failed");
    }
    return route.continue();
  });

  await dragCardToColumn(page, `e2e 롤백 할일 ${unique}`, "완료");

  // UI must roll back to 0% once the network failure is handled, not stay optimistically at 100%.
  await expect(page.getByText("0%")).toBeVisible({ timeout: 5000 });

  await page.unroute("**/api/todos/*");
  await page.reload();
  await expect(page.getByText("0%")).toBeVisible();

  await deleteGoalByTitle(page, `e2e 롤백 목표 ${unique}`);
});
