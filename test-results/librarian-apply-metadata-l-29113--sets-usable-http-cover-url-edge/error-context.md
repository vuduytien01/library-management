# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: librarian-apply-metadata.spec.ts >> librarian: apply fetched metadata sets usable http cover url
- Location: tests\playwright\librarian-apply-metadata.spec.ts:4:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for getByText('Import from R2')

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e7]: 
  - generic [ref=e8]: Hệ thống gặp sự cố
  - generic [ref=e9]: Đã có lỗi xảy ra trong quá trình xử lý. Đừng lo lắng, dữ liệu của bạn vẫn an toàn.
  - generic [ref=e11]: Attempted to navigate before mounting the Root Layout component. Ensure the Root Layout component is rendering a Slot, or other navigator on the first render.
  - generic [ref=e13] [cursor=pointer]: Thử lại ngay
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // E2E: seeds auth and checks Apply fetched metadata produces http(s) cover
  4  | test("librarian: apply fetched metadata sets usable http cover url", async ({
  5  |   page,
  6  | }) => {
  7  |   // Ensure test user is super-admin so the Import UI shows
  8  |   await page.addInitScript(() => {
  9  |     try {
  10 |       const profile = {
  11 |         id: "test-super-admin",
  12 |         fullName: "Playwright Test",
  13 |         role: "ADMIN",
  14 |         avatarUrl: null,
  15 |         bio: null,
  16 |         favoriteGenres: [],
  17 |         xp: 0,
  18 |         level: 1,
  19 |         is_locked: false,
  20 |         lock_reason: null,
  21 |         locale: "vi",
  22 |         email: "playwright@test",
  23 |         is_super_admin: true,
  24 |         membershipType: "BASIC",
  25 |       };
  26 |       // Persist for AsyncStorage-backed persistence and expose to test harness
  27 |       try {
  28 |         localStorage.setItem("BIBLIO_OFFLINE_PROFILE", JSON.stringify(profile));
  29 |       } catch (e) {}
  30 |       try {
  31 |         (window as any).__TEST_PROFILE = profile;
  32 |       } catch (e) {}
  33 |     } catch (e) {
  34 |       // ignore
  35 |     }
  36 |   });
  37 | 
  38 |   // Navigate to librarian audiobooks page
  39 |   await page.goto(`/audiobooks`);
  40 | 
  41 |   // Open R2 importer
> 42 |   await page.getByText("Import from R2").click();
     |                                          ^ Error: locator.click: Test timeout of 120000ms exceeded.
  43 | 
  44 |   // Wait for listing to finish (the loader text is removed)
  45 |   const listingText = page.locator("text=Listing objects...");
  46 |   await listingText.waitFor({ state: "detached", timeout: 20000 });
  47 | 
  48 |   // Click the first listed file (file entries show sizes like "MB")
  49 |   const firstFileSize = page.locator("text=MB").first();
  50 |   await firstFileSize.waitFor({ state: "visible", timeout: 20000 });
  51 |   await firstFileSize.click();
  52 | 
  53 |   // Wait for the form modal to show the Apply button and click it
  54 |   const applyBtn = page.getByText("Apply fetched metadata");
  55 |   await applyBtn.waitFor({ state: "visible", timeout: 10000 });
  56 |   await applyBtn.click();
  57 | 
  58 |   // The cover preview should render an <img> with an http(s) src
  59 |   const img = page.locator("img").first();
  60 |   await expect(img).toHaveAttribute("src", /https?:\/\//);
  61 | });
  62 | 
```