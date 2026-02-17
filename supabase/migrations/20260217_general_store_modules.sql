-- Add fixed_cost_monthly and target_profit_monthly to profiles if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS fixed_cost_monthly float DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_profit_monthly float DEFAULT 0;

-- Create cash_plan table
CREATE TABLE IF NOT EXISTS cash_plan (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL, -- Format: 'YYYY-MM'
  opening_cash float DEFAULT 0,
  cash_in float DEFAULT 0,
  cash_out float DEFAULT 0,
  closing_cash float DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Enable RLS
ALTER TABLE cash_plan ENABLE ROW LEVEL SECURITY;

-- Policies for cash_plan
CREATE POLICY "Users can view their own cash plan" 
ON cash_plan FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update their own cash plan" 
ON cash_plan FOR ALL 
USING (auth.uid() = user_id);
