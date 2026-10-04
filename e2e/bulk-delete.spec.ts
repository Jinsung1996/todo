import { test, expect } from "@playwright/test";
import { deleteGoalByTitle } from "./helpers";

test("체크박스로 여러 목표를 한 번에 선택해 삭제한다", async ({ page }) => {
  const unique = Date.now();
  const names = [`벌크 목표 A ${unique}`, `벌크 목표 B ${unique}`, `벌크 목표 C ${unique}`];

  await page.goto("/goals");
  for (const name of names) {
    await page.getByPlaceholder("목표 제목").fill(name);
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  await page.getByRole("button", { name: "여러 개 삭제" }).click();

  // Select the first two, leave the third unchecked.
  for (const name of names.slice(0, 2)) {
    await page
      .locator("li", { hasText: name })
      .getByRole("checkbox")
      .check();
  }

  await expect(page.getByRole("button", { name: /선택 삭제 \(2\)/ })).toBeEnabled();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /선택 삭제/ }).click();

  await expect(page.getByText(names[0])).toHaveCount(0);
  await expect(page.getByText(names[1])).toHaveCount(0);
  await expect(page.getByText(names[2])).toBeVisible();

  // Selection mode exits automatically after a bulk delete.
  await expect(page.getByRole("button", { name: "여러 개 삭제" })).toBeVisible();

  // Clean up the remaining goal via the normal single-delete path.
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator("li", { hasText: names[2] })
    .getByRole("button", { name: "삭제" })
    .click();
  await expect(page.getByText(names[2])).toHaveCount(0);

  // Guaranteed teardown regardless of the UI assertions above, so a flake here
  // never leaks test data into the dev database (this is a no-op if already deleted).
  for (const name of names) {
    await deleteGoalByTitle(page, name);
  }
});
