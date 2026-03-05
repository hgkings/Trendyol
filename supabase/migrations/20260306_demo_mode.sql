-- Add 'connected_demo' as valid status for marketplace_connections
ALTER TABLE public.marketplace_connections
    DROP CONSTRAINT IF EXISTS marketplace_connections_status_check;

ALTER TABLE public.marketplace_connections
    ADD CONSTRAINT marketplace_connections_status_check
    CHECK (status IN ('disconnected','connected','connected_demo','pending_test','error'));
