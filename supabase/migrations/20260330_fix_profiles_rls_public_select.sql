-- CRITICAL FIX: profiles tablosu SELECT policy'si herkese acik
-- Eski: SELECT USING (true) — tum kullanicilar tum profilleri okuyabiliyor
-- Yeni: SELECT USING (auth.uid() = id) — kullanici sadece kendi profilini okuyabilir

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
