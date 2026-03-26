-- trendyol_webhook_events: incoming Trendyol webhook payloads
CREATE TABLE IF NOT EXISTS public.trendyol_webhook_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id       UUID,
  event_type          TEXT,
  seller_id           TEXT,
  shipment_package_id BIGINT,
  order_number        TEXT,
  status              TEXT,
  payload             JSONB,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed           BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.trendyol_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trendyol_webhook_events_select_own"
  ON public.trendyol_webhook_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trendyol_webhook_events_user_received
  ON public.trendyol_webhook_events (user_id, received_at DESC);

-- Add webhook_active flag to marketplace_connections
ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS webhook_active BOOLEAN NOT NULL DEFAULT false;
