# Handoff: Library App - “Thu vien Nguoi” / Human Books Roadmap

Date: 2026-05-22

## Current Conversation State

The user wants to add a “library human” model inspired by https://humanlibrary.org/ to the existing app at `D:\library-app`. The preferred Vietnamese product name is “Thu vien Nguoi”. They asked for a roadmap so they can code it themselves, not immediate implementation.

Important: the active shell context shown later points to `C:\Users\tien2004\Downloads\Vietnamese-license-plates-_-Group-3---NEW-main`, but that is unrelated to this feature. For the library feature, continue from `D:\library-app` unless the user explicitly redirects.

## Update 2026-05-22 - Active App Fix State

The latest user focus shifted from the “Thu vien Nguoi” roadmap to fixing current `D:\library-app` runtime issues and preserving the handoff state.

### Follow-up Implementation Completed

The follow-up fix pass completed these items:

- Removed all raw `box-shadow` declarations from `global.css`; the NativeWind CSS-to-RN reproduction command now passes.
- Restored strict TypeScript settings and removed `baseUrl` from `tsconfig.json`; full `npx tsc --noEmit --pretty false` now passes.
- Added a bootstrap timeout/failsafe in `src/services/bootstrap/useAppBootstrap.ts`.
- Implemented time-of-day greeting in `app/(member)/index.tsx` and added `good_afternoon`, `good_evening`, and `good_night` locale keys.
- Fixed book detail header back/share handlers and z-index/elevation so the buttons respond.
- Wired `src/core/mediaCache.ts` into book cover, audiobook cover, audiobook audio playback, and clear-local-data flow.
- Fixed small typecheck blockers: missing `MaterialCommunityIcons` import, invalid `haptics.notification` call, duplicate style keys in member home, and typed `LogisticsDashboard` styles.
- Started Expo web dev server on `http://localhost:8081`; both `/` and `/book` returned HTTP 200.

Verification after implementation:

- `npx tailwindcss ... | cssToReactNativeRuntime(...)`: passed with `OK rules=35`.
- `npx tsc --noEmit --pretty false`: passed.
- `npx jest tests/unit/sanity.test.ts --runInBand --forceExit`: passed.
- `git diff --check`: passed.

Reported issues in this thread:

- App was stuck on `Loading BiblioTech...`.
- TypeScript reported `baseUrl` deprecation and asked for `ignoreDeprecations: "6.0"` if `baseUrl` stays.
- Member home still said “Good morning” in the afternoon.
- The top back/share buttons on the book detail screen did not respond.
- User requested local cache state for book images and audiobook audio.
- Expo Go crashed with `TypeError: Cannot read properties of undefined (reading '0')` at `react-native-css-interop` `parseAspectRatio`.

Important repo state discovered after review:

- Current tracked diff against `origin/main` only touches `metro.config.js`, `package.json`, `package-lock.json`, and `tsconfig.json`.
- `codex-handoff-library-human-20260522.md` and `src/core/mediaCache.ts` are untracked.
- `src/core/mediaCache.ts` exists, but current repo search showed it is not yet imported by the book/audiobook screens or the audio kernel, so media cache is not wired into the app yet.
- `app/(member)/index.tsx` still renders `t("common.good_morning")`; dynamic time-of-day greeting is not implemented in the current file.
- `src/services/bootstrap/useAppBootstrap.ts` catches bootstrap errors but has no explicit timeout/failsafe around session/profile/i18n work.
- `tsconfig.json` currently has `strict: false`, `noImplicitAny: false`, `skipLibCheck: true`, `ignoreDeprecations: "5.0"`, and still keeps `baseUrl: "."`. This weakens typechecking and does not match the TypeScript diagnostic that asked for `"6.0"`.

Expo Go crash root cause:

- The crash is reproducible without launching Expo Go by piping generated Tailwind CSS into `react-native-css-interop`:

  ```powershell
  npx tailwindcss -i ./global.css --config ./tailwind.config.js --content "./app/**/*.{js,jsx,ts,tsx}" "./src/**/*.{js,jsx,ts,tsx}" | node -e "const { cssToReactNativeRuntime } = require('react-native-css-interop/dist/css-to-rn'); let css=''; process.stdin.on('data', d => css += d); process.stdin.on('end', () => cssToReactNativeRuntime(css));"
  ```

- The thrown error is the same `parseAspectRatio` failure.
- Instrumenting `parseDeclaration` showed the declaration right before the crash is `box-shadow`.
- In `react-native-css-interop@0.2.4`, the `box-shadow` case falls through into the `aspect-ratio` case, so the error message points at `aspect-ratio` even though the app has no `aspect-*` class.
- The project CSS source causing this is `global.css`, specifically raw CSS:

  ```css
  .hover-premium:hover {
    @apply -translate-y-1 scale-[1.02];
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
  }
  ```

Recommended next fixes:

- Remove or replace raw `box-shadow` in `global.css` so NativeWind Metro interop can parse native CSS. Do not rely on `DISABLE_NATIVEWIND_INTEROP=1` as the real fix.
- Revisit the `nativewind` bump to `4.2.4`; either pin back to a known-good version or keep it only after the CSS parser crash is fixed.
- Restore strict TypeScript defaults unless the user explicitly wants weaker checks. For the `baseUrl` warning, either remove `baseUrl` or set `ignoreDeprecations: "6.0"` intentionally.
- Implement dynamic greeting on member home using local device hour and add `good_afternoon`, `good_evening`, and `good_night` keys in both locale files.
- Fix book detail back/share touch handling with header z-index/elevation, non-blocking overlay layers, `router.canGoBack()` fallback, and share `try/catch`.
- Wire `src/core/mediaCache.ts` into book cover display, audiobook cover/audio source loading, and cache clearing.
- Add a bootstrap timeout that calls `forceInitialize()` even if session/profile/i18n stalls.

Review findings already produced:

- `[P1]` NativeWind `4.2.4` bump currently crashes Expo Go through `react-native-css-interop@0.2.4`.
- `[P2]` `tsconfig.json` globally weakens typechecking with `strict: false` and `noImplicitAny: false`.
- `[P2]` `ignoreDeprecations: "5.0"` does not silence the reported TypeScript `baseUrl` deprecation; the diagnostic asked for `"6.0"` if `baseUrl` remains.

Verification status:

- `npx tsc --noEmit --pretty false` still fails. Top failures include missing `MaterialCommunityIcons`, duplicate keys in `app/(member)/index.tsx`, and multiple React Native style typing errors.
- The NativeWind CSS-to-RN reproduction command fails with the same `parseAspectRatio` stack trace.
- No broad formatting or destructive git commands were run.

## Repo Facts Already Discovered

- `D:\library-app` is an Expo Router + React Native + Supabase/Postgres app.
- Main member routes live under `app/(member)`; librarian routes live under `app/(librarian)`.
- `PremiumTabBar.tsx` hardcodes visible route names, so a new member tab must be added there too.
- Data access patterns are in `src/features/*` and hooks are composed through `src/hooks/useLibrary.ts` and `src/hooks/library/*`.
- Supabase migrations live under `supabase/migrations/`; existing migrations are the right place for new DB tables/RLS/RPCs.
- Worktree had existing user changes when inspected: `metro.config.js`, `package-lock.json`, `package.json`, `tsconfig.json`, and untracked `src/core/mediaCache.ts`. Do not revert or overwrite these without user approval.

## User Preferences Locked In

- Feature name: “Thu vien Nguoi” rather than “Human Library” branding.
- Meeting format: offline only.
- Scope requested: roadmap for the user to self-code.
- Language: Vietnamese by default, concise, with `answer -> code -> explanation -> next steps` when applicable.

## Recommended Feature Shape

Build this as a separate module, not as normal `books`, because physical books are ISBN/inventory/borrow-record based while this feature schedules conversations with people.

Core v1 flow:

1. Librarian creates/publishes a “Human Book” profile.
2. Librarian creates offline time slots with location and capacity.
3. Member browses published profiles, filters by topic/language, and requests a slot.
4. Librarian approves/rejects requests.
5. After the session, request can be marked completed and optionally receive feedback.

Suggested tables:

- `human_books`: profile/person listing, title, summary, topics, languages, status, safety notes, owner/profile reference.
- `human_book_slots`: offline session windows, location, capacity, status.
- `human_book_requests`: member booking requests, status, reader question, librarian note.
- `human_book_feedback`: rating/comment after completed session.

Security default:

- RLS should let members read only published/open data and only manage their own requests.
- Librarian/admin roles can manage all human-library records.
- The human-book owner should only see records related to them where needed.

## Implementation Roadmap Previously Proposed

- Add one Supabase migration for the new tables, indexes, basic constraints, and RLS policies.
- Add `src/features/human-library/` service/types with functions such as list published human books, get detail, list slots, create/cancel request, list my requests, list pending requests, approve/reject request.
- Add a React Query hook wrapper, likely `useHumanLibrary()`, and export it through `src/hooks/useLibrary.ts` or the local hook composition pattern.
- Add member UI routes: browse list, detail/booking screen, and my requests screen.
- Add librarian UI routes: profile management, slot management, request moderation.
- Add Vietnamese/English i18n keys under a `human_library` namespace or existing locale structure.
- Add focused tests for service behavior, UI states, and Supabase RLS/permission expectations.

## Test Plan

### 1. Database / RLS Tests

- Member chỉ xem được `human_books` có status `PUBLISHED`.
- Member chỉ xem được `human_book_slots` đang `OPEN`.
- Member tạo được request cho slot hợp lệ, chưa hủy, còn chỗ.
- Member chỉ đọc/sửa/hủy được request của chính mình.
- Member không được approve/reject request.
- Librarian/admin đọc và quản lý được toàn bộ human books, slots, requests.
- Không cho đặt lịch khi slot đã `CANCELLED`, đã hết capacity, hoặc thời gian đã qua.
- Không cho tạo request trùng cho cùng member + slot nếu request đang `PENDING` hoặc `APPROVED`.

### 2. Service / Hook Tests

- `listHumanBooks()` trả về danh sách đã publish, sắp xếp ổn định.
- `getHumanBook(id)` trả về detail + slots mở.
- `createHumanBookRequest()` gửi đúng `human_book_id`, `slot_id`, `reader_question`.
- `cancelHumanBookRequest()` chỉ hủy request của user hiện tại.
- `listMyHumanBookRequests()` trả về request của member hiện tại.
- `approveHumanBookRequest()` và `rejectHumanBookRequest()` chỉ dùng cho librarian/admin.
- Các hàm service xử lý đúng lỗi Supabase: permission denied, not found, duplicate request, slot full.

### 3. Member UI Tests

- Màn hình “Thư viện Người” hiển thị loading, empty, error, và danh sách profile.
- Bộ lọc topic/language hoạt động đúng.
- Màn detail hiển thị title, summary, topics, languages, safety note, slot offline.
- Member đặt lịch thành công sau khi nhập câu hỏi/mong muốn trò chuyện.
- Không cho submit nếu thiếu slot hoặc thiếu câu hỏi bắt buộc.
- Sau khi đặt lịch, request xuất hiện trong “Lịch hẹn của tôi”.
- Member hủy được request đang `PENDING`, không hủy được request đã `COMPLETED`.

### 4. Librarian UI Tests

- Librarian tạo/sửa/publish/suspend human book profile.
- Librarian tạo slot offline với thời gian, địa điểm, capacity.
- Librarian xem danh sách request `PENDING`.
- Librarian approve/reject request và trạng thái cập nhật đúng ở phía member.
- Librarian mark completed sau buổi trò chuyện.
- UI hiển thị đúng khi không có request chờ duyệt.

### 5. Manual Acceptance Scenarios

- Scenario 1: Librarian tạo một human book, tạo slot offline, member thấy và đặt lịch được.
- Scenario 2: Librarian approve request, member thấy trạng thái chuyển sang `APPROVED`.
- Scenario 3: Slot capacity = 1; sau khi có request approved, member khác không đặt trùng được.
- Scenario 4: Member A không thấy hoặc chỉnh được request của Member B.
- Scenario 5: Librarian suspend human book; member không còn thấy profile đó trong danh sách.
- Scenario 6: Toàn bộ flow chạy offline-only, không có meeting URL/video-call field trong v1.

## Suggested Skills

- `handoff`: use again only if another transition is needed.
- `acquire-codebase-knowledge`: optional if the next agent needs a deeper full-repo map before implementation; not necessary for a narrow implementation pass.
- Supabase plugin/tooling: useful if the next session will inspect or apply database migrations/RLS.
- Build Web Apps plugin/frontend guidance: useful if the next session implements member/librarian screens.

## Constraints And Cautions

- The project is dirty; preserve unrelated user changes.
- In Plan Mode, do not mutate repo files. If execution mode starts, use `apply_patch` for manual file edits.
- Avoid using “Human Library” as the app’s public name unless the user confirms licensing/branding permission; use “Thu vien Nguoi”.
- Offline-only means do not add online meeting links, video-call providers, or meeting URL fields in v1 unless the user changes scope.
