-- ============================================================
-- Phase 14 – Community Security Audit & Performance Indexes
-- ============================================================

-- 1. ENABLE RLS on community tables (idempotent)
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. BOOK_CLUBS policies
-- ============================================================
DROP POLICY IF EXISTS "Allow read clubs to all authenticated" ON public.book_clubs;
CREATE POLICY "Allow read clubs to all authenticated"
  ON public.book_clubs FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow creator to update/delete own club" ON public.book_clubs;
CREATE POLICY "Allow creator to update/delete own club"
  ON public.book_clubs FOR ALL
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Allow authenticated to insert club" ON public.book_clubs;
CREATE POLICY "Allow authenticated to insert club"
  ON public.book_clubs FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- ============================================================
-- 3. BOOK_CLUB_MEMBERS policies
-- ============================================================
DROP POLICY IF EXISTS "Allow read members of joined clubs" ON public.book_club_members;
CREATE POLICY "Allow read members of joined clubs"
  ON public.book_club_members FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow user to join clubs themselves" ON public.book_club_members;
CREATE POLICY "Allow user to join clubs themselves"
  ON public.book_club_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user to leave clubs themselves" ON public.book_club_members;
CREATE POLICY "Allow user to leave clubs themselves"
  ON public.book_club_members FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. BOOK_CLUB_MESSAGES policies (Anti-IDOR)
-- ============================================================
DROP POLICY IF EXISTS "Allow members to read messages in their clubs" ON public.book_club_messages;
CREATE POLICY "Allow members to read messages in their clubs"
  ON public.book_club_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.book_club_members
      WHERE club_id = book_club_messages.club_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow members to send messages in their clubs" ON public.book_club_messages;
CREATE POLICY "Allow members to send messages in their clubs"
  ON public.book_club_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.book_club_members
      WHERE club_id = book_club_messages.club_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Allow user to delete own messages" ON public.book_club_messages;
CREATE POLICY "Allow user to delete own messages"
  ON public.book_club_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. USER_BADGES policies
-- ============================================================
DROP POLICY IF EXISTS "Allow read own badges" ON public.user_badges;
CREATE POLICY "Allow read own badges"
  ON public.user_badges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert badges" ON public.user_badges;
CREATE POLICY "Service role can insert badges"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 6. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_xp_desc          ON public.profiles (xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level             ON public.profiles (level);
CREATE INDEX IF NOT EXISTS idx_book_club_members_club_id  ON public.book_club_members (club_id);
CREATE INDEX IF NOT EXISTS idx_book_club_members_user_id  ON public.book_club_members (user_id);
CREATE INDEX IF NOT EXISTS idx_book_club_messages_club_id ON public.book_club_messages (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id        ON public.user_badges (user_id);
