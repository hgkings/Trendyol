-- commission_rates: per-user custom commission rates per marketplace+category
CREATE TABLE IF NOT EXISTS public.commission_rates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  marketplace  TEXT NOT NULL,
  category     TEXT NOT NULL,
  rate         NUMERIC(6,2) NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace, category)
);

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own rates"
  ON public.commission_rates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rates"
  ON public.commission_rates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rates"
  ON public.commission_rates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rates"
  ON public.commission_rates FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_commission_rates_user_id ON public.commission_rates (user_id);
CREATE INDEX idx_commission_rates_lookup ON public.commission_rates (user_id, marketplace, category);
