-- ====================================================================
-- ACTUALIZACIÓN DE FOREIGN KEYS - SOLUCIÓN SEGURA
-- ====================================================================
-- Este script actualiza SOLO las foreign keys problemáticas
-- sin duplicar políticas ni tablas existentes
-- ====================================================================
-- Fecha: 2026-01-01
-- Propósito: Permitir eliminación de usuarios sin errores
-- ====================================================================

-- ===========================================
-- 1. ACTUALIZAR FOREIGN KEYS
-- ===========================================

-- Inventory History: Mantener registros al eliminar usuario
ALTER TABLE public.inventory_history
DROP CONSTRAINT IF EXISTS inventory_history_created_by_fkey;

ALTER TABLE public.inventory_history
ADD CONSTRAINT inventory_history_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Waste Reports: Mantener registros al eliminar usuario  
ALTER TABLE public.waste_reports
DROP CONSTRAINT IF EXISTS waste_reports_created_by_fkey;

ALTER TABLE public.waste_reports
ADD CONSTRAINT waste_reports_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Analytics Events: Eliminar eventos al eliminar usuario
ALTER TABLE public.analytics_events
DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;

ALTER TABLE public.analytics_events
ADD CONSTRAINT analytics_events_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Emission Types: Eliminar en cascada cuando se elimina organización
ALTER TABLE public.emission_types
DROP CONSTRAINT IF EXISTS emission_types_organization_id_fkey;

ALTER TABLE public.emission_types
ADD CONSTRAINT emission_types_organization_id_fkey
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ===========================================
-- 2. ACTUALIZAR DEFAULT DE PLAN_TYPE
-- ===========================================

ALTER TABLE public.organizations 
ALTER COLUMN plan_type SET DEFAULT NULL;

-- ===========================================
-- 3. VERIFICACIÓN
-- ===========================================

-- Verificar foreign keys actualizadas
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'SET NULL' THEN '✅ SET NULL'
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE'
        ELSE '⚠️ ' || rc.delete_rule
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_name = 'users'
ORDER BY tc.table_name;

-- Verificar default de plan_type
SELECT 
    column_name,
    column_default,
    CASE 
        WHEN column_default = 'NULL::text' OR column_default IS NULL THEN '✅ NULL'
        ELSE '⚠️ ' || column_default
    END as status
FROM information_schema.columns
WHERE table_name = 'organizations' 
    AND column_name = 'plan_type'
    AND table_schema = 'public';

-- Verificar emission_types FK
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    rc.delete_rule,
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE'
        ELSE '⚠️ ' || rc.delete_rule
    END as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'emission_types'
    AND kcu.column_name = 'organization_id';

-- ===========================================
-- RESULTADO ESPERADO:
-- ===========================================
-- inventory_history.created_by → SET NULL ✅
-- waste_reports.created_by → SET NULL ✅
-- analytics_events.user_id → CASCADE ✅
-- emission_types.organization_id → CASCADE ✅
-- organizations.plan_type → NULL ✅
-- ===========================================
