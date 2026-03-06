-- ============================================================
-- Hepsiburada Marketplace Integration — Raw Data Tables
-- ============================================================

-- 1) hepsiburada_products_raw
CREATE TABLE IF NOT EXISTS public.hepsiburada_products_raw (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id       uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
    external_product_id text NOT NULL,
    merchant_sku        text,
    barcode             text,
    title               text NOT NULL DEFAULT '',
    brand               text,
    category_path       text,
    sale_price          numeric,
    raw_json            jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE(connection_id, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_hb_products_user ON public.hepsiburada_products_raw(user_id);
CREATE INDEX IF NOT EXISTS idx_hb_products_conn ON public.hepsiburada_products_raw(connection_id);

ALTER TABLE public.hepsiburada_products_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hb products"
    ON public.hepsiburada_products_raw FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hb products"
    ON public.hepsiburada_products_raw FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hb products"
    ON public.hepsiburada_products_raw FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hb products"
    ON public.hepsiburada_products_raw FOR DELETE
    USING (auth.uid() = user_id);


-- 2) hepsiburada_orders_raw
CREATE TABLE IF NOT EXISTS public.hepsiburada_orders_raw (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connection_id   uuid NOT NULL REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
    order_number    text NOT NULL,
    order_date      timestamptz,
    status          text,
    total_price     numeric,
    raw_json        jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(connection_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_hb_orders_user ON public.hepsiburada_orders_raw(user_id);
CREATE INDEX IF NOT EXISTS idx_hb_orders_conn ON public.hepsiburada_orders_raw(connection_id);

ALTER TABLE public.hepsiburada_orders_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hb orders"
    ON public.hepsiburada_orders_raw FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hb orders"
    ON public.hepsiburada_orders_raw FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hb orders"
    ON public.hepsiburada_orders_raw FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hb orders"
    ON public.hepsiburada_orders_raw FOR DELETE
    USING (auth.uid() = user_id);


-- 3) Allow 'connected_demo' in marketplace_connections status check (backward compat)
-- Update CHECK constraint to also allow 'hepsiburada' as marketplace value (already text, no constraint)
-- No change needed — marketplace is already a free text field.
