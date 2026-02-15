-- Add plan columns to users table (assuming users table exists, or auth.users if separate)
-- Note: Often in Supabase 'users' are in auth.users, and we might need a public profile table.
-- If the app uses a public 'profiles' table mapped to auth.users, add columns there.
-- If the app uses a separate 'users' table, add there.

-- Checking if we need to create a profiles table or update existing
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  plan text DEFAULT 'free',
  plan_expires_at timestamptz,
  email_alerts_enabled boolean DEFAULT true,
  updated_at timestamptz
);

-- Turn on RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, plan_expires_at)
  VALUES (new.id, new.email, 'free', null);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger creation (drop if exists to be safe/idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- If profiles table already existed, ensure columns are added
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan text DEFAULT 'free';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan_expires_at') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expires_at timestamptz;
    END IF;
END $$;
