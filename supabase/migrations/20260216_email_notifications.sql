-- Add notification columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_email TEXT,
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ;

-- Ensure RLS allows users to manage their own settings
-- (Assuming an existing policy covers UPDATE based on 'id = auth.uid()')
-- If not, create one:
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (id = auth.uid());

-- Allow selecting these columns
CREATE POLICY "Users can view their own profile" 
ON profiles FOR SELECT 
USING (id = auth.uid());
