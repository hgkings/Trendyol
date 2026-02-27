-- Add pro_until and updated_at columns to profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'pro_until') THEN
        ALTER TABLE public.profiles ADD COLUMN pro_until timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN updated_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan_expires_at') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expires_at timestamptz;
    END IF;
END $$;
