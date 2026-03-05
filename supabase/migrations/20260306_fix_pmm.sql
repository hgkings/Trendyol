-- ============================================================
-- Fix: Add connection_id + indexes to product_marketplace_map
-- ============================================================

-- 1) Add connection_id column
ALTER TABLE public.product_marketplace_map
    ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.marketplace_connections(id) ON DELETE CASCADE;

-- 2) User-scoped indexes for fast barcode/SKU matching
CREATE INDEX IF NOT EXISTS idx_pmm_user_sku ON public.product_marketplace_map(user_id, merchant_sku);
CREATE INDEX IF NOT EXISTS idx_pmm_user_barcode ON public.product_marketplace_map(user_id, barcode);
CREATE INDEX IF NOT EXISTS idx_pmm_connection ON public.product_marketplace_map(connection_id);
