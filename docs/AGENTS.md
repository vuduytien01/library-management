# Agent Instructions (BiblioTech v2.0)

## Agent Quick Start

- **Install & start**: `npm install` then `npm run start` (mobile) or `npm run web` (web).
- **Typecheck**: `npx tsc --noEmit` or `npx tsc --noEmit path/to/file.ts` for file-scoped checks.
- **Tests**: `npm test` (single run) or `npm run test:watch`.
- **Database (Prisma)**: `npm run db:push` and `npm run db:studio` (see [prisma/schema.prisma](prisma/schema.prisma)).

## Local dev commands (exact scripts)

Use the repository `package.json` scripts when possible:

- **Start (Expo)**: `npm run start`
- **Start (web)**: `npm run web`
- **Run tests**: `npm test` / `npm run test:watch` / `npm run test:coverage`
- **Prisma**: `npm run db:push`, `npm run db:studio`, `npm run postinstall` runs `prisma generate`

These are canonical — prefer these over handwritten alternatives.

## Commit Attribution

AI commits MUST include:

```Co-Authored-By: Antigravity AI <antigravity@google.com>

```

## File-Scoped Commands

| Task      | Command                            |
| --------- | ---------------------------------- |
| Typecheck | `npx tsc --noEmit path/to/file.ts` |
| DB Sync   | `npx prisma generate`              |

## Secret Codes (For Testing)

- **Librarian Profile**: `LIB_SECRET_2026`
- **Admin Profile**: `ADMIN_SECRET_2026`

## Key Conventions

- **Role-Based Access**: Librarian > Admin > Member.
- **SQL Logic**: Use `supabase.rpc` for critical business logic.
- **i18n**: Use `t('key')`. **SAFE initialization required** (Check `getLocales()`).
- **Database**: Use direct Postgres connection string. Quote `"Role"`.
- **Error Handling**: Every major screen must be wrapped in an Error Boundary.

## Where to look (quick links)

- **App entry & routes**: [app/](app)
- **Frontend components**: [src/components/](src/components)
- **Server / services**: [src/services/](src/services)
- **Database schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Scripts & experiments**: [scratch/](scratch) and [scripts/](scripts)
- **Docs & architecture notes**: [CONTEXT.md](CONTEXT.md), [docs/](docs)

## Feature Patterns

- **Scanning**: Use @/src/components/CameraScanner.tsx (Expo-camera).
- **Payment**: Use @/src/services/paymentService.ts (VietQR + HMAC).
- **Book Metadata**: Use @/src/services/bookService.ts (Google Books/OpenLib).

## Pitfalls & guidance for agents

- Expo native modules: prefer web-safe APIs for quick feedback; native builds may need a device/simulator.
- Reanimated and native libraries can cause local dev friction — run web first when possible.
- Keep secrets out of commits; use `.env` and environment variables.
- When modifying DB schema, run `npm run db:push` and `prisma generate` and add a short migration note.

## Contact / attribution

- When producing automated commits, include the agreed commit attribution header (if required by workflow).

## Avoid

- No generic colors (use the blue/dark theme).
- No hardcoded secrets (use .env).
- Avoid bypassing `useLibrary` hooks for data fetching.
