-- ====================================================================
-- LIMPIEZA COMPLETA - Ejecutar ANTES de master_schema.sql
-- ====================================================================
-- Este script elimina TODAS las políticas, triggers y funciones viejas
-- para evitar conflictos con el nuevo schema
-- ====================================================================

-- 1. ELIMINAR TODAS LAS POLÍTICAS RLS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 2. ELIMINAR TODOS LOS TRIGGERS
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I CASCADE', 
            r.trigger_name, r.event_object_table);
    END LOOP;
END $$;

-- 3. ELIMINAR TODAS LAS FUNCIONES
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_email_sync() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_email() CASCADE;
DROP FUNCTION IF EXISTS public.protect_license_keys() CASCADE;
DROP FUNCTION IF EXISTS public.is_trial_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_trial_info(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_trial_status() CASCADE;
DROP FUNCTION IF EXISTS public.debug_auth_status() CASCADE;

-- 4. ELIMINAR TODAS LAS TABLAS (en orden correcto)
DROP TABLE IF EXISTS public.analytics_events CASCADE;
DROP TABLE IF EXISTS public.waste_reports CASCADE;
DROP TABLE IF EXISTS public.inventory_history CASCADE;
DROP TABLE IF EXISTS public.organization_settings CASCADE;
DROP TABLE IF EXISTS public.cost_prices CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.pending_orders CASCADE;
DROP TABLE IF EXISTS public.organization_invites CASCADE;
DROP TABLE IF EXISTS public.license_keys CASCADE;
DROP TABLE IF EXISTS public.prices CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.emission_types CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- 5. LIMPIAR PUBLICACIONES DE REALTIME (Opcional - comentado por si acaso)
-- Esto solo es necesario si las tablas ya existían en realtime
-- Si da error, ignóralo y continúa
/*
DO $$ 
BEGIN
    -- Remover tablas de la publicación realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.inventory;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.prices;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.emission_types;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.pending_orders;
    EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL;
    END;
END $$;
*/

-- Confirmación
SELECT 
    '✅ Limpieza completa!' as status,
    'Ahora puedes ejecutar master_schema.sql' as next_step;
