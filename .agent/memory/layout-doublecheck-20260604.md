## Summary
Ran a layout doublecheck pass on key web screens with Playwright/Edge screenshots for desktop and mobile.

## Decisions
Kept changes scoped to the test-profile web guard and the mobile admin system KPI row. `window.__TEST_PROFILE` is honored only outside production.

## Files changed
- `app/_layout.tsx`
- `app/index.tsx`
- `app/(admin)/system.tsx`

## Tests
- `npx tsc --noEmit --pretty false --skipLibCheck`
- Playwright/Edge screenshot pass saved under `reports/layout-doublecheck/`

## Known issues
- Some console errors during layout checks come from API calls without a real auth token and React Native Web hydration warnings on profile; they were not layout regressions in this pass.

## Next steps
- If profile web hydration warnings become a target, audit nested pressables/headings in `app/(member)/profile.tsx` separately.
