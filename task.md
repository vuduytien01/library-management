# BiblioTech v2.0 Task List

- [x] **Predictive Demand AI (Làn 20)**
  - [x] [NEW] Edge Function `predictive-demand-ai`: AI logic for forecasting.
  - [x] [MODIFY] `src/hooks/library/useLibrarianAnalytics.ts`: Added prediction mutation.
  - [x] [MODIFY] `app/(librarian)/insights.tsx`: Added UI for demand forecasting.

- [x] **Full Localization & Audit (Final Phase)**
  - [x] [MODIFY] `src/i18n/locales/en.json`: Consolidated categories, added profile/months.
  - [x] [MODIFY] `src/i18n/locales/vi.json`: Consolidated categories, added profile/months.
  - [x] [MODIFY] `app/(member)/search.tsx`: Robust category/language filtering.
  - [x] [MODIFY] `app/(admin)/index.tsx`: Cleaned up hardcoded strings and warnings.
  - [x] [MODIFY] `app/(member)/profile.tsx`: Final UI polish and translation sync.
  - [x] Complete final codebase audit and resolve remaining locale-aware string conflicts in `(admin)/index.tsx` and `(member)/profile.tsx`.
  - [x] Finalize cross-module regression testing, focusing on locale-aware community search and filtering logic.
  - [x] Consolidate and cleanse `en.json` and `vi.json` for structural parity and consistent translation mapping.
  - [x] Finalize documentation (`task.md`, `walkthrough.md`) to meet standard requirements for production deployment readiness.
  - [ ] Add Playwright auth bootstrap: allow E2E tests to bypass login (test user seeding / \_\_TEST_PROFILE handling)
