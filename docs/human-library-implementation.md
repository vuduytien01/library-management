Minimal implementation and docs update for Human Library feature

What I changed (minimal, non-destructive):

- Added i18n keys for Human Library in src/i18n/locales/en.json and src/i18n/locales/vi.json.
- Wired the Human Library UI screens to use translation keys:
  - app/(member)/human-library/index.tsx
  - app/(member)/human-library/[id].tsx
  - app/(member)/human-library/proposals.tsx
- Data source uses public profiles (roles LIBRARIAN/ADMIN) via Supabase with a local fallback list when the env is invalid or empty.

Notes and next steps:

- Migration/RLS: No schema or RLS migration was applied here. If you want a dedicated human_library table or stricter policies, point me to the migration file or confirm the desired schema.
- Verification: Tests were not re-run in this session.
- Localization: If you'd like different copy, tell me the exact Vietnamese/English wording and I'll update the locale JSONs.
