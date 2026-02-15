-- ═══════════════════════════════════════════════════════════════
-- Kar Kocu: Row Level Security (RLS) Policies
-- Run this in Supabase SQL Editor if you see 403 errors.
--
-- This script is IDEMPOTENT — safe to run multiple times.
-- It drops existing policies first to avoid "already exists" errors.
-- ═══════════════════════════════════════════════════════════════

-- ─── Enable RLS ───
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- PROFILES TABLE
-- Columns: id (uuid, PK, FK→auth.users), email, plan, email_alerts_enabled
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
CREATE POLICY "Users can read their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════
-- ANALYSES TABLE
-- Columns: id, user_id, product_name, marketplace, inputs, outputs, risk, created_at
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert their own analyses" ON analyses;
CREATE POLICY "Users can insert their own analyses"
  ON analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own analyses" ON analyses;
CREATE POLICY "Users can read their own analyses"
  ON analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own analyses" ON analyses;
CREATE POLICY "Users can update their own analyses"
  ON analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own analyses" ON analyses;
CREATE POLICY "Users can delete their own analyses"
  ON analyses FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
CREATE POLICY "Users can insert their own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
CREATE POLICY "Users can read their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION: Run this to confirm policies are active
-- ═══════════════════════════════════════════════════════════════
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
