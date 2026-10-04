import { test, expect } from "@playwright/test";
import { deleteGoalByTitle } from "./helpers";

test("대시보드/보드에서 클릭으로 할일 상세로 이동하고 상태를 변경한다", async ({ page }) => {
  const unique = Date.now();

  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(`클릭 목표 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`클릭 목표 ${unique}`).click();

  await page.getByPlaceholder("주간계획 제목").fill(`클릭 주간계획 ${unique}`);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill("2026-01-01");
  await dateInputs.nth(1).fill("2026-01-07");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByText(`클릭 주간계획 ${unique}`).click();

  await page.getByPlaceholder("할일 제목").fill(`클릭 할일 ${unique}`);
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByText(`클릭 할일 ${unique}`)).toBeVisible();

  // Clicking the card title (not dragging) must open the detail page, not move the card.
  await page.getByText(`클릭 할일 ${unique}`, { exact: true }).click();
  await expect(page).toHaveURL(/\/todos\/[a-f0-9]{24}$/);
  await expect(page.getByRole("heading", { name: `클릭 할일 ${unique}` })).toBeVisible();
  await expect(page.getByText(`${unique}`.length ? `클릭 목표 ${unique} / 클릭 주간계획 ${unique}` : "")).toBeVisible();

  await page.getByRole("button", { name: "완료" }).click();
  await expect(page.getByRole("button", { name: "완료" })).toHaveClass(/bg-foreground/);
  await page.reload();
  await expect(page.getByRole("button", { name: "완료" })).toHaveClass(/bg-foreground/);

  // Dashboard: goal and (non-done) todo lists are clickable through to their detail pages.
  await page.goto("/");
  await page.getByRole("link", { name: new RegExp(`클릭 목표 ${unique}`) }).click();
  await expect(page).toHaveURL(/\/goals\/[a-f0-9]{24}$/);

  await deleteGoalByTitle(page, `클릭 목표 ${unique}`);
});
