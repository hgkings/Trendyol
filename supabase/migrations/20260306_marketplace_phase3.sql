-- ============================================================
-- Phase 3: Normalization, Matching, Cron
-- ============================================================

-- 1) Add matching columns to analyses table
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS merchant_sku text;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS marketplace_source text DEFAULT 'manual';
ALTER TABLE public.analyses ADD COLUMN IF NOT EXISTS auto_synced boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_analyses_merchant_sku ON public.analyses(merchant_sku);
CREATE INDEX IF NOT EXISTS idx_analyses_barcode ON public.analyses(barcode);


-- 2) product_marketplace_map
CREATE TABLE IF NOT EXISTS public.product_marketplace_map (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace         text NOT NULL DEFAULT 'trendyol',
    external_product_id text NOT NULL,
    merchant_sku        text,
    barcode             text,
    external_title      text,
    internal_product_id uuid REFERENCES public.analyses(id) ON DELETE SET NULL,
    match_confidence    text NOT NULL DEFAULT 'manual_required'
                            CHECK (match_confidence IN ('high','medium','manual_required')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, marketplace, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_pmm_user_id ON public.product_marketplace_map(user_id);
CREATE INDEX IF NOT EXISTS idx_pmm_internal ON public.product_marketplace_map(internal_product_id);

-- RLS
ALTER TABLE public.product_marketplace_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mappings"
    ON public.product_marketplace_map FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings"
    ON public.product_marketplace_map FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- No INSERT/DELETE from client — server only via service_role

-- updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pmm_updated_at') THEN
        CREATE TRIGGER trg_pmm_updated_at
            BEFORE UPDATE ON public.product_marketplace_map
            FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
    END IF;
END;
$$;
