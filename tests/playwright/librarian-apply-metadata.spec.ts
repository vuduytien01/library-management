import { expect, test } from "@playwright/test";

// E2E: seeds auth and checks Apply fetched metadata produces http(s) cover
test("librarian: apply fetched metadata sets usable http cover url", async ({
  page,
}) => {
  // Ensure test user is super-admin so the Import UI shows
  await page.addInitScript(() => {
    try {
      const profile = {
        id: "test-super-admin",
        fullName: "Playwright Test",
        role: "ADMIN",
        avatarUrl: null,
        bio: null,
        favoriteGenres: [],
        xp: 0,
        level: 1,
        is_locked: false,
        lock_reason: null,
        locale: "vi",
        email: "playwright@test",
        is_super_admin: true,
        membershipType: "BASIC",
      };
      // Persist for AsyncStorage-backed persistence and expose to test harness
      try {
        localStorage.setItem("BIBLIO_OFFLINE_PROFILE", JSON.stringify(profile));
      } catch (e) {}
      try {
        (window as any).__TEST_PROFILE = profile;
      } catch (e) {}
    } catch (e) {
      // ignore
    }
  });

  // Navigate to librarian audiobooks page
  await page.goto(`/audiobooks`);

  // Open R2 importer
  await page.getByText("Import from R2").click();

  // Wait for listing to finish (the loader text is removed)
  const listingText = page.locator("text=Listing objects...");
  await listingText.waitFor({ state: "detached", timeout: 20000 });

  // Click the first listed file (file entries show sizes like "MB")
  const firstFileSize = page.locator("text=MB").first();
  await firstFileSize.waitFor({ state: "visible", timeout: 20000 });
  await firstFileSize.click();

  // Wait for the form modal to show the Apply button and click it
  const applyBtn = page.getByText("Apply fetched metadata");
  await applyBtn.waitFor({ state: "visible", timeout: 10000 });
  await applyBtn.click();

  // The cover preview should render an <img> with an http(s) src
  const img = page.locator("img").first();
  await expect(img).toHaveAttribute("src", /https?:\/\//);
});
