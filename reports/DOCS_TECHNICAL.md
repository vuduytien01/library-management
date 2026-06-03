# BiblioTech v2.0 Premium Edition - Technical Documentation & Implementation Report

## 1. Project Overview

BiblioTech v2.0 is a premium library management ecosystem designed with a "Member-First" philosophy. It transitions from a basic record-keeping system to an AI-powered social reading platform with robust offline capabilities.

### Core Philosophy

- **Aesthetics**: Premium dark mode with vibrant accents (Blue/Emerald/Gold).
- **Intelligence**: Integrated AI Librarian (Gemini) for discovery and analytics.
- **Reliability**: Hardened offline-first architecture for remote reading.
- **Community**: Social reading rooms, collaborative annotations, and real-time club chats.

---

## 2. Technology Stack

- **Framework**: React Native with Expo (SDK 51+)
- **Language**: TypeScript (Strict mode)
- **Database**: Supabase (PostgreSQL + Real-time + RLS)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Authentication**: Supabase Auth (OTP + Password)
- **Animations**: React Native Reanimated + Moti
- **Storage**: AsyncStorage + Expo FileSystem (for PDFs/Audio)
- **AI Engine**: Google Gemini Pro (via Edge Functions & Client SDK)
- **Payments**: VietQR (Service-side HMAC verification)

---

## 3. Key Technical Implementations

### Làn 11: AI Librarian & Voice Search

- **Feature**: Natural language discovery and voice-to-text search.
- **Key Files**:
  - `src/services/aiService.ts`: Core logic for intent classification and semantic retrieval.
  - `app/(member)/index.tsx`: Voice Search FAB integration.
- **Mechanism**: Uses `expo-av` for audio capture, simulated/real transcription via Gemini, and semantic embedding matching for "Intent-based Search".

### Làn 12: Hardened Offline Experience

- **Feature**: Reliable reading without internet connection.
- **Key Files**:
  - `src/services/downloadService.ts`: Lifecycle management of local assets.
  - `src/components/PDFReader.tsx`: Native fallback and offline URI prioritization.
  - `app/(member)/downloads.tsx`: Centralized cache management (Clear All Cache).
- **Mechanism**: `expo-file-system` for persistent storage, mapping ISBNs to local file URIs in `AsyncStorage`.

### Làn 13: Social Reading & Book Clubs

- **Feature**: Real-time interaction and community engagement.
- **Key Files**:
  - `app/(member)/club/[id].tsx`: High-fidelity chat with floating reactions.
  - `src/hooks/library/useBookClubs.ts`: Real-time broadcast channel integration.
- **Mechanism**: Supabase Realtime "Broadcast" for lightweight presence and reaction effects (❤️, 🔥, etc.).

### Làn 15: Deep Analytics Dashboard

- **Feature**: AI-powered staff intelligence.
- **Key Files**:
  - `app/(librarian)/insights.tsx`: KPI visualization and trend analysis.
  - `app/(librarian)/demand-prediction.tsx`: Demand forecasting.
- **Mechanism**: Complex PostgreSQL aggregations via `supabase.rpc` to calculate borrow density and inventory turnover.

### Làn 18: Collaborative Annotation

- **Feature**: Public highlights and social notes.
- **Key Files**:
  - `src/components/AnnotationOverlay.tsx`: Interactive note-taking UI.
- **Mechanism**: Relational mapping between `reading_status` and `annotations` table with RLS policies allowing public viewing but private editing.

---

## 4. Specific Technical Deep-Dives

### 4.1 Real-time Community "Broadcast" (Lane 13)

- **Problem**: Database-backed reactions are heavy and create unnecessary row bloat.
- **Solution**: Implemented ephemeral broadcast channels.
- **Technique**:
  - `useClubChat.ts`: Uses `supabase.channel(id).on('broadcast', { event: 'reaction' }, callback).subscribe()`.
  - `club/[id].tsx`: `FloatingEmoji` component uses `react-native-reanimated` with `useSharedValue` and `withSequence` to create a "rising" effect that auto-destructs after 2s, ensuring 0 memory overhead.

### 4.2 Voice-Activated Discovery (Lane 11)

- **Problem**: Standard text search is slow for premium "lean-back" experiences.
- **Solution**: Integrated AI Librarian with real-time audio recording.
- **Technique**:
  - `index.tsx`: Uses `expo-av` with `RecordingOptionsPresets.HIGH_QUALITY`.
  - `aiService.ts`: Processes transcriptions through a "Semantic Intent Engine" that maps phrases like "tìm sách kinh điển" to specific metadata queries.

### 4.3 Atomic Cache Management (Lane 12)

- **Problem**: Downloads can become orphaned or consume too much storage.
- **Solution**: Atomic persistent mapping.
- **Technique**:
  - `downloadService.ts`: Uses `FileSystem.documentDirectory` for secure sandboxing.
  - `clearAll()`: Iterates through `FileSystem.readDirectoryAsync` and cross-references with a `JSON` map to ensure only library-related files are touched.

### 4.4 R2 Audiobook Delivery & Optimization

- **Problem**: Large single-file audiobooks (up to 462MB) hosted on Cloudflare R2 caused severe freezing during seeking (tua) due to `expo-av` downloading the entire file, and high latency when loading the audiobook tab due to sequential AI translations.
- **Solution**: "Public Bucket + CDN Edge Cache" architecture combined with "Fast Mode" metadata browsing.
- **Technique**:
  - **Storage**: Enabled **R2.dev subdomain / Custom Domain** for public read access directly to the R2 bucket.
  - **Latency**: Bypassed the custom Cloudflare Worker to serve files directly via Cloudflare's global CDN cache, natively supporting HTTP `Range` requests for instant seeking in `expo-av` with 0ms cold-start latency.
  - **Database**: Pre-populated localized metadata (`title_en`, `title_vi`, etc.) and cleared generic narrator tags to decouple AI dependencies during list rendering.
  - **App Logic**: Implemented a `fast=true` parameter in `books.service.ts` (`enrichWithBookMetadata`) to skip expensive Supabase/Gemini lookups during standard browsing, resolving the UI hang.

---

## 5. Architecture & Linking Principles

The system follows a strict **Domain-Driven Design (DDD)** approach within the React Native context:

1. **UI Layer (`app/`)**: Expo Router file-based routing. Screens are thin wrappers around hooks.
2. **Logic Layer (`src/hooks/`)**: Centralized business logic. `useLibrary` serves as the primary gateway, grouping sub-hooks (books, borrows, clubs) for clean access.
3. **Service Layer (`src/services/`)**: Stateless utilities for infrastructure (Download, Sync, AI, Payment).
4. **Data Layer (`src/api/`)**: Supabase client configuration and direct PostgreSQL RPC calls for critical transactions (Role validation, Borrowing logic).

### Role-Based Access Control (RBAC)

- **Librarian**: Full inventory and user management.
- **Admin**: System-wide configuration and security audits.
- **Member**: Personal library, downloads, and community features.
- *Strict RLS (Row Level Security)* on all tables ensures data privacy.

---

## 5. Optimization & Performance

- **List Performance**: All book cards use `React.memo` and `FlatList` optimizations (windowSize, initialNumToRender).
- **Haptic Feedback**: Standardized confirmation system via `hapticService.ts` for premium tactile experience.
- **Error Boundaries**: Every major role-based dashboard is wrapped in a recovery boundary to prevent full app crashes.
- **Offline Cache**: `downloadService` automatically cleans up orphaned files and handles storage constraints.

---

## 6. Business Logic Enforcement

- **Borrowing Limit**: Maximum of 5 active borrows per member.
- **Inventory Buffer**: Minimum of 3 physical copies maintained for critical titles.
- **Overdue Handling**: Automatic daily check-in script triggers fine estimation and account locking.

---

## 7. Complete Development History (Chronological)

1. **Foundation**: Initialized Expo project with Supabase Auth and basic CRUD.
2. **Librarian Core**: Built Inventory management, barcode scanning (`CameraScanner.tsx`), and role-based gating.
3. **Member Experience**: Implemented Book Details, Borrowing logic (`useLibrary`), and Digital Membership cards.
4. **Premium Hardening**:
   - **Audiobooks**: Integrated `thuviensachnoi.vn` scraping and metadata enrichment.
   - **AI Discovery**: Deployed Gemini-powered librarian and voice search.
   - **Social Reading**: Launched Book Clubs, Reading Rooms, and Collaborative Annotations.
   - **Reliability**: Finalized offline reading mode and storage cleanup tools.

---

**Report Generated by Antigravity AI**
*Co-Authored-By: Antigravity AI <antigravity@google.com>*
