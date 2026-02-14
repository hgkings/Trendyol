-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Allow users to insert their own profile (e.g. after signup/login)
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);


-- Analyses Policies
-- Allow users to insert their own analyses
CREATE POLICY "Users can insert their own analyses"
ON analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own analyses
CREATE POLICY "Users can read their own analyses"
ON analyses FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own analyses
CREATE POLICY "Users can update their own analyses"
ON analyses FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own analyses
CREATE POLICY "Users can delete their own analyses"
ON analyses FOR DELETE
USING (auth.uid() = user_id);


-- OPTIONAL: Database Trigger for automatic profile creation
-- This is recommended to ensure a profile exists immediately after signup.
-- If you use this, you don't need the client-side profile creation.

-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, email, plan)
--   VALUES (new.id, new.email, 'free');
--   RETURN new;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
