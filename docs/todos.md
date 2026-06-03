# TODOs

- [ ] Refactor `app/(member)/index.tsx` into smaller components and helpers. This file contains many responsibilities and high cognitive complexity. See: `app/(member)/index.tsx`.
  - Suggested first step: extracted avatar upload logic to `src/features/members/helpers.ts` (done).
  - Next step: extract gamification and charts into `src/features/members/analytics`.
