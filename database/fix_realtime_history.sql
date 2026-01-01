-- ====================================================================
-- FIX: RE-ENABLE REALTIME GRACEFULLY
-- ====================================================================

-- 1. Set Replica Identity to FULL (Always safe to re-run)
ALTER TABLE public.inventory_history REPLICA IDENTITY FULL;
ALTER TABLE public.waste_reports REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;

-- 2. Add to publication only if not already there
-- Since ADD TABLE doesn't have IF NOT EXISTS, we use a DO block to check
DO $$
BEGIN
    -- Inventory History
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'inventory_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_history;
    END IF;

    -- Waste Reports
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'waste_reports'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_reports;
    END IF;

    -- General Inventory (Just in case)
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'inventory'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
    END IF;
END $$;
