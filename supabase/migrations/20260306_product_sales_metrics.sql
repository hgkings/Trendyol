-- ============================================================
-- Product Sales Metrics — monthly aggregated order data
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_sales_metrics (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    internal_product_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    marketplace         text NOT NULL DEFAULT 'trendyol',
    period_month        date NOT NULL,  -- first day of month, e.g. 2026-03-01
    sold_qty            int NOT NULL DEFAULT 0,
    returned_qty        int NOT NULL DEFAULT 0,
    gross_revenue       numeric NOT NULL DEFAULT 0,
    net_revenue         numeric NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, internal_product_id, marketplace, period_month)
);

CREATE INDEX IF NOT EXISTS idx_psm_user ON public.product_sales_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_psm_product ON public.product_sales_metrics(internal_product_id);
CREATE INDEX IF NOT EXISTS idx_psm_period ON public.product_sales_metrics(period_month);

-- RLS: user reads own data; writes via server only
ALTER TABLE public.product_sales_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
    ON public.product_sales_metrics FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE from client — server only via service_role

-- Add auto_sales_qty to analyses for suggested monthly volume
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS auto_sales_qty int;

-- updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_psm_updated_at') THEN
        CREATE TRIGGER trg_psm_updated_at
            BEFORE UPDATE ON public.product_sales_metrics
            FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
    END IF;
END;
$$;
