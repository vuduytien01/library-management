import { expect, test } from "@playwright/test";

test("home shows THE LIBRARY title", async ({ page }) => {
  await page.goto("/");
  // Client-side rendering can take a moment; allow a longer timeout for hydration.
  await expect(page.locator("text=THE LIBRARY")).toBeVisible({
    timeout: 15000,
  });
});
