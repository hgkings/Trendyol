-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES public.analyses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('danger', 'warning', 'info')),
    category TEXT NOT NULL DEFAULT 'general',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, dedupe_key)
);

-- Add email_alerts_enabled to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Trigger for Email Notifications (via Edge Function)
CREATE OR REPLACE FUNCTION public.handle_new_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- We only trigger for 'danger' types
  IF (NEW.type = 'danger') THEN
    -- This requires the pg_net extension to be enabled in Supabase
    -- The actual URL would be your Supabase Edge Function URL
    -- For security, usually called via background webhooks in Supabase UI
    -- but here is the SQL representation
    PERFORM
      net.http_post(
        url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'record', row_to_json(NEW),
          'table', 'notifications',
          'type', 'INSERT'
        )
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
