# 📚 Audiobook Metadata Scraping - Consolidated Plan & Task Status

> **Backup Date:** 2026-04-27
> **Status:** Active / In Progress
> **Project:** BiblioTech v2.0 (Audiobook Integration)

---

## 🛠 Project Objective
Extract comprehensive audiobook metadata from **Fonos.vn** and **VoizFM** to populate the BiblioTech database, enabling advanced search and cross-platform linking for library members.

---

## 📈 Current Progress Tracker

| Phase | Task | Status | Note |
| :--- | :--- | :--- | :--- |
| **P1** | Environment Setup | ✅ Done | Cheerio, Playwright, p-limit, pg installed. |
| **P2** | Fonos Scraper | ✅ Done | Fixed `__NEXT_DATA__` path to `dehydratedState.queries`. |
| **P3** | VoizFM Scraper | 🟡 In Progress | Intercepting API works; DOM fallback needs better selectors. |
| **P4** | Database (Supabase) | ✅ Done | `audiobook_metadata` table created. RLS policy added. |
| **P5** | Storage Helper | ✅ Done | `save-to-db.ts` using `pg` for direct connection bypass. |
| **P6** | Service Layer | ✅ Done | `audiobookMetadataService.ts` for React Native app. |
| **P7** | Verification | 🟡 In Progress | Fonos verified. VoizFM partial. DB verified via SQL. |

---

## 📝 Technical Plan (Deep Dive)

### 1. Scraper Architecture
- **Fonos (Next.js)**: Static extraction from `__NEXT_DATA__` script tag.
  - *Current Insight*: Data resides in `props.pageProps.dehydratedState.queries` rather than direct `pageProps.book`.
  - *Fields*: `isbnNumber`, `voiceActors`, `duration` (float), `coverImageUrl`.
- **VoizFM (React SPA)**: Playwright-based interception.
  - *Method*: Monitor `page.on('response')` for `/api/books/` JSON payloads.
  - *Fallback*: DOM scraping if API is restricted or not triggered.

### 2. Database Integration
- **Table**: `audiobook_metadata`
- **Primary Key**: `id` (UUID) + Unique Constraint on `(source_platform, source_id)`.
- **Connection Strategy**:
  - *Local Scripts*: Use `pg` with `DATABASE_URL` + Port `6543` (Supabase Pooler) + `?pgbouncer=true`.
  - *App Layer*: Standard Supabase Client via `audiobookMetadataService.ts`.

---

## 🚀 Next Immediate Tasks

1.  **Refine VoizFM Selectors**: Improve DOM parsing for title, author, and chapters in `voizfm-scraper.ts` to ensure 100% data capture even without API interception.
2.  **Bulk Crawl Run**: Execute `run-scraper.ts` for a small catalog (e.g., 50 books) to stress test the persistence layer.
3.  **UI Integration**: Add the search/lookup functionality to the React Native `BookDetail` screen using `audiobookMetadataService`.
4.  **Error Handling**: Wrap the scraper in a retry loop for network timeouts.

---

## 📁 Repository Map (Scraper Folder)
- `scratch/metadata-scraper/types.ts`: Shared TS interfaces.
- `scratch/metadata-scraper/fonos-scraper.ts`: Fixed Fonos logic.
- `scratch/metadata-scraper/voizfm-scraper.ts`: Playwright-based VoizFM logic.
- `scratch/metadata-scraper/save-to-db.ts`: Direct Postgres upsert utility.
- `scratch/metadata-scraper/run-scraper.ts`: CLI coordinator.
- `scratch/metadata-scraper/results/`: Local JSON backup of scraped data.

---

## 🔐 Credentials & Security
- **DB Connection**: Using `DATABASE_URL` from `.env`.
- **API Access**: No public API used; relying on public web data.
- **Ethics**: Rate limiting implemented at 2s/req to respect target server load.

---
*Co-Authored-By: Antigravity AI <antigravity@google.com>*
