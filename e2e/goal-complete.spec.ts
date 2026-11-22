import { test, expect } from "@playwright/test";
import { deleteGoalByTitle, loginAsTestUser } from "./helpers";

test("연간 목표와 주간 목표를 완료로 표시하고 되돌린다", async ({ page }) => {
  const goalTitle = `완료 목표 ${Date.now()}`;
  const weekTitle = `완료 주간 ${Date.now()}`;

  await loginAsTestUser(page);
  await page.goto("/goals");
  await page.getByPlaceholder("목표 제목").fill(goalTitle);
  await page.getByRole("button", { name: "추가" }).click();

  const goalRow = page.locator("li", { hasText: goalTitle });
  // Wait for the save itself — the UI flips optimistically before the PATCH lands.
  const goalSaved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await goalRow.getByRole("button", { name: "완료", exact: true }).click();
  await goalSaved;
  await expect(goalRow.getByRole("button", { name: "완료 취소" })).toBeVisible();
  await expect(goalRow.getByText(goalTitle)).toHaveClass(/line-through/);

  // Survives a reload, so it was saved.
  await page.reload();
  await expect(goalRow.getByRole("button", { name: "완료 취소" })).toBeVisible();

  // The dashboard's 연간 완료 card counts it (other tests' goals may share the DB).
  await page.goto("/");
  const year = new Date().getFullYear();
  await expect(page.getByRole("link", { name: new RegExp(`${year}년 연간 완료 [1-9]\\d*/[1-9]\\d*`) })).toBeVisible();
  await page.goto("/goals");

  await goalRow.getByRole("button", { name: "완료 취소" }).click();
  await expect(goalRow.getByRole("button", { name: "완료", exact: true })).toBeVisible();

  await goalRow.getByRole("link").click();
  await page.getByPlaceholder("주간 목표 제목").fill(weekTitle);
  await page.locator('input[type="date"]').first().fill("2026-11-16");
  await page.locator('input[type="date"]').nth(1).fill("2026-11-22");
  await page.getByRole("button", { name: "추가" }).click();

  const weekRow = page.locator("li", { hasText: weekTitle });
  const weekSaved = page.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await weekRow.getByRole("button", { name: "완료", exact: true }).click();
  await weekSaved;
  await expect(page.getByText("주간 목표 완료 1 / 1")).toBeVisible();
  await page.reload();
  await expect(weekRow.getByRole("button", { name: "완료 취소" })).toBeVisible();

  await page.goto("/weeks");
  await expect(page.getByText(weekTitle)).toHaveClass(/line-through/);

  await deleteGoalByTitle(page, goalTitle);
});
